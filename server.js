var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Forecast = require('./Forecast');
const mongoose = require('mongoose');
// const fetch = require('node-fetch');

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://weatherwebapiproject:Weather2024@weather.ank6g9x.mongodb.net/?retryWrites=true&w=majority&appName=Weather";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));  
app.use(passport.initialize());

var router = express.Router();

var SECRET_KEY = process.env.SECRET_KEY;

// Define the directory where your images are stored
const path = require('path');

// Web API Endpoint
router.get('/api/weather', async (req, res) => {
  try {
    const response = await fetch('https://api.weather.gov/gridpoints/TOP/31,80/forecast');
    if (!response.ok) {
      throw new Error('Network response not ok');
    }
    const data = await response.json();
    res.send(data);
  }
  catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// Signup endpoint
router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

// Signin endpoint
router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

//auth-verification endpoint
function verifyToken(req, res, next) {
    var token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ success: false, msg: 'No token provided.' });
    }
    jwt.verify(token.split(' ')[1], SECRET_KEY, function(err, decoded) {
        if (err) {
            return res.status(500).json({ success: false, msg: 'Failed to authenticate token.' });
        }
        req.userId = decoded.id;
        next();
    });
}

router.route('/forecast/idofforecast')
    .get(authJwtController.isAuthenticated, function (req, res) {
        Forecast.findOne({_id: req.params.idofforecast}, function(err, data) {
            if (err || !data) {
                res.json({status: 400, message: "Forecast couldn't be found."});
            }
            else {
                if(err){
                    console.log("Error encountered.");
                    res.send(err);
                }
                else {
                    res.json({status: 200, message: "Forecast found!", Forecast: data});
                }
            }
        });
    })

    router.route('/forecast')
        .get(authJwtController.isAuthenticated, async function (req, res) {
            try {
                // Fetch current weather data
                const weatherResponse = await fetch('https://api.weather.gov/gridpoints/TOP/31,80/forecast');
                if (!weatherResponse.ok) {
                    throw new Error('Network response not ok');
                }
                const weatherData = await weatherResponse.json();

                // Find the first document in the Forecast collection
                const forecast = await Forecast.findOne();

                if (!forecast) {
                    res.json({ status: 400, message: "Forecast couldn't be found." });
                } else {
                    res.json({ status: 200, message: "Forecast found!", forecast });
                }
            } catch (error) {
                console.error("Error fetching forecast:", error);
                res.status(500).json({ error: "Failed to fetch forecast" });
            }
        })
    
    .put(authJwtController.isAuthenticated, async function(req, res) {
        try {
            // Fetch current weather data
            const weatherResponse = await fetch('https://api.weather.gov/gridpoints/TOP/31,80/forecast');
            if (!weatherResponse.ok) {
                throw new Error('Network response not ok');
            }
            const weatherData = await weatherResponse.json();
    
            // Find all documents in the Forecast collection
            const forecasts = await Forecast.find();
    
            // Loop through each forecast document
            for (let i = 0; i < forecasts.length && i < 14; i++) {
                const forecast = forecasts[i];
                
                // Update each forecast document with new weather data
                await Forecast.findOneAndUpdate({ _id: forecast._id }, { 
                    timeOfDay: weatherData.properties.periods[i].name,
                    temperatureFarenheit: weatherData.properties.periods[i].temperature,
                    conditions: weatherData.properties.periods[i].shortForecast,
                    windSpeed: weatherData.properties.periods[i].windSpeed,
                    precipitationChance: weatherData.properties.periods[i].probabilityOfPrecipitation.value,
                    imageUrl: getWeatherImageUrl(weatherData.properties.periods[i].shortForecast)
                });
            }
    
            res.json({ status: 200, message: "Forecasts updated" });
        } catch (error) {
            console.error('Error updating forecasts:', error);
            res.status(500).json({ error: 'Failed to update forecasts' });
        }
    });
    
    // Function to get weather image URL based on conditions
    function getWeatherImageUrl(conditions) {
        switch (conditions.toLowerCase()) {
            case 'cloudy':
            case 'partly cloudy then slight chance showers and thunderstorms':
            case 'chance showers and thunderstorms then sunny':
                return 'https://i.imgur.com/tTqV2XF.png';
            case 'rainy':
            case 'showers and thunderstorms':
            case 'showers and thunderstorms likely':
            case 'chance showers and thunderstorms':
            case 'slight chance showers and thunderstorms then chance showers and thunderstorms':
                return 'https://i.imgur.com/YDNCivR.png';
            case 'snowy':
                return 'https://i.imgur.com/dXGTfkB.png';
            case 'sunny':
            case 'mostly clear':
                return 'https://i.imgur.com/yJulfKw.png';
            default:
                return 'https://i.imgur.com/j6oE6lq.png';
        }
    }
    

// Fetch the forecast for the next 7 days
router.route('/forecastlist')
    .get(authJwtController.isAuthenticated, async function (req, res) {
        try {
            // Fetch forecast data for the next 7 days from weather API
            const response = await fetch('https://api.weather.gov/gridpoints/TOP/31,80/forecast');
            if (!response.ok) {
                throw new Error('Network response not ok');
            }
            const weatherData = await response.json();

            const forecastPeriods = weatherData.properties.periods.slice(0, 14);

            // Initialize an array to store translated forecast data
            const translatedForecastData = [];

            // Loop through each forecast period
            for (const period of forecastPeriods) {
                const translatedForecast = {
                    timeOfDay: period.name,
                    temperatureFarenheit: period.temperature,
                    conditions: period.shortForecast,
                    windSpeed: period.windSpeed,
                    precipitationChance: period.probabilityOfPrecipitation?.value || 0, // Handling possible absence of precipitation data
                    imageUrl: getWeatherImageUrl(period.shortForecast)
                };

                // Push the translated forecast into the array
                translatedForecastData.push(translatedForecast);
            }

            // Send the translated forecast data as response
            res.json(translatedForecastData);
        }
        catch (error) {
            console.error('Error fetching weather data:', error);
            res.status(500).json({ error: 'Failed to fetch weather data' });
        }
    });

  
    
app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app;
