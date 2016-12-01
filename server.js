"use strict";

let unirest = require('unirest');   // For consuming external api
let express = require('express');   // For serving our own routes
let events = require('events');

// Challenge: alter getFromApi function below to also get related artists. 
// Must happen after 'end' event is emitted from first getFromApi call (to 'search')

// `args` is an object provided to the endpoint's querystring
let getFromApi = function(endpoint, args) {
    let emitter = new events.EventEmitter();    // Need an emitter to communicate that the 'get' worked or didn't
    
    // The call to getFromApi() below hits 'https://api.spotify.com/v1/search', 
    // which differs from the endpoint at the top of the doc page for that service (https://developer.spotify.com/web-api/get-artist/).
    // However, scroll to the bottom and you'll see the '/search' endpoint described
    // with a query string that matches what is passed to .qs()
    unirest.get('https://api.spotify.com/v1/' + endpoint)   
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body);
                } else {
                    emitter.emit('error', response.code);   // Attach error code instead of body
                }
            });
    return emitter;
};

// Set up routes
let app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    let searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });
    
    // Success
    searchReq.on('end', function(item) {    // Success!
        let artist = item.artists.items[0];
        res.json(artist);
    });
    
    searchReq.on('error', function(code) {  // Fail
        res.sendStatus(code);
    });
});

app.listen(process.env.PORT || 8080);