/**
 * Created by shawnmccarthy on 1/22/17.
 */
'use strict;';
//Include crypto to generate the forecast ID
var crypto = require('crypto');
module.exports = function () {
    return {
        userList: [],
        /*
         * Save the user inside the "db".
         */
        save: function (user) {
            user.id = crypto.randomBytes(20).toString('hex'); // fast enough for our purpose
            this.userList.push(user);
            return 1;
        },
        /*
         * Retrieve a forecast with a given id or return all the forecasts if the id is undefined.
         */
        find: function (id) {
            if (id) {
                return this.userList.find(function (element) {
                    return element.id === id;
                });
            }
            else {
                return this.userList;
            }
        },
        findOne: function (name) {
            if (name) {
                return this.userList.find(function (element) {
                    return element.username === name;
                });
            }
            else {
                return this.userList;
            }
        },
        /*
         * Delete a forecast with the given id.
         */
        remove: function (id) {
            var found = 0;
            this.userList = this.userList.filter(function (element) {
                if (element.id === id) {
                    found = 1;
                }
                else {
                    return element.id !== id;
                }
            });
            return found;
        },
        /*
         * Update a forecast with the given id
         */
        update: function (id, user) {
            var userIndex = this.userList.findIndex(function (element) {
                return element.id === id;
            });
            if (userIndex !== -1) {
                this.userList[userIndex].username = user.username;
                this.userList[userIndex].password = user.password;
                return 1;
            }
            else {
                return 0;
            }
        }
    };
};