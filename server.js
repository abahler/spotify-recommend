"use strict";   // Necessary for ES2015 syntax to work

let unirest = require('unirest');   // For consuming external API
let express = require('express');   // For serving our own routes
let events = require('events');     // For event emitters

// `args` is an object provided to the endpoint's querystring
let getFromApi = (endpoint, args) => {
    let emitter = new events.EventEmitter();    // Need an emitter to communicate that the 'get' worked or didn't
    
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
                    emitter.emit('error', response.code);   // Attach error code instead of body
                    // emitter.emit('error', response.body); // Debugging only
                }
            });
    return emitter;
};

// Set up routes
let app = express();
app.use(express.static('public'));

// *** CODE CHALLENGE ***
// Make request to 'top tracks' endpoint in parallel for each related artist
// Initially, just get this working, whether it's async or synchronous. Then, rewrite if necessary to run in parallel.

app.get('/search/:name', (req, res) => {
    let searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });
    
    // Successfully retrieved artist information
    searchReq.on('end', (item) => {
        console.log('Item (response from first API call): ', item);
        var artist = item.artists.items[0]; // Parse artist name from response body
                                            // Note use of `var` instead of `let` here, 
                                            //    because the latter was seen as undefined in console, 
                                            //    and we need to be able to add properties to it
        
        // Now we need to retrieve related artists, using only the artist id
        let id = artist.id;

        let relatedArtistsReq = getFromApi('artists/' + id + '/related-artists', {});   
        
        // res.send({test:'test'});
    
        relatedArtistsReq.on('end', (relatedItem) => {    // Successfully grabbed related artists
            artist.related = relatedItem.artists;
            // res.json(artist);        // Comment out now that we're making a third API call (top tracks)
            
            // Now, send a request to the 'top tracks' endpoint for each artist
            let topTracksErrors = [];
            artist.related.forEach( (v, i) => {
                /*
                // Confirms we are properly accessing artist id
                console.log('v dot id: ', v.id);
                console.log('v dot name: ', v.name);
                console.log('i: ', i);
                */
                
                let topTracksReq = getFromApi('/artists/' + v.id + '/top-tracks', {
                    country: 'US'   // required, per the documentation
                    // TODO: provide auth/token information? API docs say 'request requires authentication'
                });
                
                topTracksReq.on('end', (tracksItem) => {
                    console.log('The end event was emitted!');
                    v.tracks = tracksItem.tracks;   // Operates on a reference, so modification will outlast loop
                    console.log(v);
                });
                
                topTracksReq.on('error', (code) => {
                    console.log('The error event was emitted!');
                    console.log('Error code: ', code);
                    console.log('Response body from API: ', topTracksReq);
                    topTracksErrors.push(code);
                    // res.sendStatus(code);
                });
            });

            if (topTracksErrors.length > 0) {
                console.log('There were errors with some of the top-tracks requests:');
                console.log(topTracksErrors);
            }            

            res.json(artist);

        });
         
        relatedArtistsReq.on('error', (code) => {
            // Requirements tell us to send a 404, so disregard actual code returned
            res.sendStatus(404);
        });
        
        // This line was where we previously send the JSON to the client code (index.html),
        // but that was before the second API call was implemented
        
        // NOTE: tried placing top-tracks requests outside relatedArtistsReq, but artist.related was undefined
        
    });
    
    // Failed to retrieve artist information
    searchReq.on('error', (code) => { 
        res.sendStatus(code);
    });
});

app.listen(process.env.PORT || 8080);