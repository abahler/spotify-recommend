"use strict";   // Necessary for ES2015 syntax to work

let unirest = require('unirest');
let express = require('express');  
let events = require('events'); 

let getFromApi = (endpoint, args) => {
    let emitter = new events.EventEmitter();    // Need an emitter to communicate nature of the response
    
    // The call to getFromApi() below hits 'https://api.spotify.com/v1/search', 
    // which differs from the endpoint at the top of the doc page for that service (https://developer.spotify.com/web-api/get-artist/).
    // However, scroll to the bottom and you'll see the '/search' endpoint described
    // with a query string that matches what is passed to .qs()
    unirest.get('https://api.spotify.com/v1/' + endpoint)   
           .qs(args)
           .end( (response) => {
                if (response.ok) {
                    emitter.emit('end', response.body);
                } else {
                    emitter.emit('error', response.code); 
                }
            });
    return emitter;
};

// Set up routes
let app = express();
app.use(express.static('public'));

app.get('/search/:name', (req, res) => {
    let searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });
    
    // Successfully retrieved artist information
    searchReq.on('end', (item) => {
        var artist = item.artists.items[0]; // Parse artist name from response body
                                            // Note use of `var` instead of `let` here, 
                                            //    because the latter was seen as undefined in console, 
                                            //    and we need to be able to add properties to it
        
        // Now we need to retrieve related artists, using only the artist id
        let id = artist.id;

        let relatedArtistsReq = getFromApi('artists/' + id + '/related-artists', {});   
        
        relatedArtistsReq.on('end', (relatedItem) => {    // Successfully grabbed related artists
            artist.related = relatedItem.artists;
            // This line is where we would send the response to the client if this was our last request

            // Now, send a request to the 'top tracks' endpoint for each artist
            let topTracksErrors = [];
            let completedTopTracksReqs = 0;
            let len = artist.related.length;    // Just a small optimization since we'll use that on each iteration
            artist.related.forEach( (v, i) => {
                
                let topTracksReq = getFromApi('artists/' + v.id + '/top-tracks', { country: 'US' });
         
                topTracksReq.on('end', (tracksItem) => {
                    v.tracks = tracksItem.tracks;   // Operates on a reference, so modification will outlast loop
                    completedTopTracksReqs += 1;
                    if (completedTopTracksReqs == len) {
                        res.json(artist);   
                    }
                });
                
                topTracksReq.on('error', (code) => {
                    // Show the user a simple error message. 
                    // index.html expects an array of songs to iterate through
                    v.tracks = ['Could not retrieve top tracks for this artist.'];
                    // Add to our errors array for a more detailed look upon completion
                    topTracksErrors.push(code);
                });
            });

        });
         
        relatedArtistsReq.on('error', (code) => {
            // Requirements say to send a 404, so disregard actual code returned
            res.sendStatus(404);
        });
        
    });
    
    searchReq.on('error', (code) => { 
        res.sendStatus(code);
    });
});

app.listen(process.env.PORT || 8080);
