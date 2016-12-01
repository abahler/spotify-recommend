"use strict";

let unirest = require('unirest');   // For consuming external api
let express = require('express');   // For serving our own routes
let events = require('events');

// `args` is an object provided to the endpoint's querystring
let getFromApi = function(endpoint, args) {
    let emitter = new events.EventEmitter();    // Need an emitter to communicate that the 'get' worked or didn't
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