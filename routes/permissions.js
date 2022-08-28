var _ = require('lodash');

const permissions = {
    property: {
        'CLIENT': {
            GET: {
                validation: function () { },
                filter: { 'permissions.user': id },
                fields: [
                    'created_at',
                    'notifications',
                    'integrations',
                    'domain',
                    'status',
                    'name',
                    'metrics',
                    'current_interval',
                    'subscription',
                    'wallet',
                    'embed',
                ]
            },
            PUT: {
                filter: { 'permissions.user': id },
                fields: [
                    'notifications',
                    'integrations',
                    'domain',
                    'name',
                    'embed',
                ]
            }
        },
        'ADMIN': {
            GET: {
                validation: function () { },
                filter: {},
                fields: []
            },
            PUT: {
                fields: []
            }
        },
    }
};

module.exports = permissions;