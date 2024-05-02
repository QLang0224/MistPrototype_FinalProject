var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
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
    res.json(data);
  } catch (error) {
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

//signin endpoint
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

router.route('/forecast')
    .get(authJwtController.isAuthenticated, async function (req, res) {
    try {
        // Fetch current weather data
        const weatherResponse = await fetch('https://api.weather.gov/gridpoints/TOP/31,80/forecast');
        if (!weatherResponse.ok) {
            throw new Error('Network response not ok');
        }
        const weatherData = await weatherResponse.json();

        // Extract current temperature in Fahrenheit and weather conditions
        const forecastId = weatherData.properties.periods.number;

        const forecast = {
            forecastId: forecastId,
            temperatureFahrenheit: weatherData.properties.periods[forecastId].temperature,
            conditions: weatherData.properties.periods[forecastId].shortForecast
        };

        // Mapping weather conditions to images
        let imageUrl;
        switch (forecast.conditions.toLowerCase()) {
            case 'cloudy':
            case 'partly cloudy then slight chance showers and thunderstorms':
            case 'chance showers and thunderstorms then sunny':
                imageUrl = 'https://i.imgur.com/tTqV2XF.png';
                break;
            case 'rainy':
            case 'showers and thunderstorms':
            case 'showers and thunderstorms likely':
            case 'chance showers and thunderstorms':
            case 'slight chance showers and thunderstorms then chance showers and thunderstorms':
                imageUrl = 'https://i.imgur.com/YDNCivR.png';
                break;
            case 'snowy':
                imageUrl = 'https://i.imgur.com/dXGTfkB.png';
                break;
            case 'sunny':
            case 'mostly clear':
                imageUrl = 'https://i.imgur.com/yJulfKw.png';
                break;
            default:
                imageUrl = 'https://i.imgur.com/j6oE6lq.png';
            }

            res.json({
                forecast,
                imageUrl
            });
        } catch (error) {
            console.error('Error fetching weather data:', error);
            res.status(500).json({ error: 'Failed to fetch weather data' });
        }
    });

// Fetch the forecast for the next 7 days
router.route('/forecastlist')
    .get(authJwtController.isAuthenticated, async function (req, res) {
    try {
      // Fetch forecast data for the next 7 days from weather API
      // Adjust the API endpoint and parameters according to the weather service
      const response = await fetch('https://api.weather.gov/gridpoints/TOP/31,80/forecast');
      if (!response.ok) {
        throw new Error('Network response not ok');
      }
      const data = await response.json();
  
      const sevenDayForecast = data.properties.periods.slice(0, 13);
  
      res.json(sevenDayForecast);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});
  
    
app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app;
