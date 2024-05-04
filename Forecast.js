var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect(process.env.DB);

// forecast schema
const ForecastSchema = new mongoose.Schema({
    timeOfDay: { type: String, required: true, index: true },
    temperatureFarenheit: { type: Number, min: [-100, 'Must be greater than 1899'], max: [150, 'Must be less than 2100']},
    conditions: { type: String, required: true, index: true },
    windSpeed: { type: String, required: true },
    precipitationChance: { type: Number },
    imageUrl: {type: String}
});

// return the model
module.exports = mongoose.model('Forecast', ForecastSchema);