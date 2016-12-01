var unirest = require('unirest');   // For consuming external api
var express = require('express');   // For serving our own routes
var events = require('events');

// `args` is an object provided to the endpoint's querystring
var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();    // Need an emitter to communicate that the 'get' worked or didn't
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body);
                } else {
                    emitter.emit('error', response.code);
                }
            });
    return emitter;
};

// Set up routes
var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });
    
    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];
        res.json(artist);
    });
    
    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(process.env.PORT || 8080);