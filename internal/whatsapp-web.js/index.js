'use strict';

const Constants = require('./src/util/Constants');

module.exports = {
    Client: require('./src/Client'),

    // Structures
    ClientInfo: require('./src/structures/ClientInfo'),
    Message: require('./src/structures/Message'),
    MessageMedia: require('./src/structures/MessageMedia'),

    // Auth Strategies
    NoAuth: require('./src/authStrategies/NoAuth'),
    LocalAuth: require('./src/authStrategies/LocalAuth'),

    ...Constants,
};
