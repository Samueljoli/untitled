'use strict';

const Base = require('../base');
const Hoek = require('hoek');
const Joi = require('joi');
const { Kind, GraphQLError } = require('graphql');
const Isemail = require('isemail');
const Uri = require('./uri');
const GuidRegex = require('./guid');
const Base64 = require('./base64');
const InputSchemas = require('./input-schemas');

// Declare internals

const internals = {};

internals.defaults = {
    name        : 'StringScalar',
    serialize   : Function,
    parseLiteral: Function,
    parseValue  : Function
};

internals.configDefaults = {
    convert    : true,
    insensitive: true
};


internals.uriRegex = Uri.createUriRegex();

internals.guidRegex = GuidRegex;

internals.base64Regex = Base64;

internals.hexRegex = (hex) => {

    const regex = new RegExp(/^#[0-9a-f]{3,6}$/i);

    return regex.exec(hex);
};

internals.alphanumRegex = (string) => {

    const regex = new RegExp(/^[a-zA-Z0-9]+$/);

    return regex.exec(string);
};

internals.tokenRegex = (token) => {

    const regex = new RegExp(/^\w+$/);

    return regex.exec(token);
};

internals.hostnameRegex = (host) => {

    const regex = new RegExp(/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/);

    return regex.exec(host);
};

internals.creditCard = (string) => {

    // Lunh Algorithm

    let i = string.length;
    let sum = 0;
    let mul = 1;

    while (i--) {
        const char = string.charAt(i) * mul;
        sum = sum + (char - (char > 9) * 9);
        mul = mul ^ 3;
    }

    const check = (sum % 10 === 0) && (sum > 0);

    return check ? true : false;
};

internals.StringScalar = class StringScalar extends Base {

    constructor() {

        super(internals.defaults);

        if (StringScalar._instance) { // Enforce singleton

            StringScalar._instance._disallowed.push('');
            StringScalar._instance._flags = {};
            StringScalar._instance._options = Hoek.clone(internals.configDefaults);

            return StringScalar._instance;
        }

        this._flags = {};
        this._options = Hoek.clone(internals.configDefaults);

        StringScalar._instance = this;
    }

    parseLiteral(ast) {

        if ((this._defaultValue && !ast)) {

            return this._defaultValue;
        }

        if (ast.kind !== Kind.STRING) {

            const msg = `KindError: expected ${Kind.STRING}, but got ${ast.kind}`;

            throw new GraphQLError(msg);
        }

        if (this._options.convert) {

            if (this._flags.case) {

                ast.value = this._flags.case === 'upper' ? ast.value.toLocaleUpperCase() : ast.value.toLocaleLowerCase();
            }
        }


        return this.validate(ast);
    }

    min(value) {

        value = Joi.attempt(value, InputSchemas.input);

        return this._test('string.min', (ast) => {

            const { length } = ast.value;

            return length >= value ? ast.value : null;
        });
    }

    max(value) {

        value = Joi.attempt(value, InputSchemas.input);

        return this._test('string.max', (ast) => {

            const { length } = ast.value;

            return length <= value ? ast.value : null;
        });
    }

    guid(versions) {

        versions = Joi.attempt(versions, InputSchemas.guid);

        return this._test('string.guid', (ast) => {

            const guid = ast.value;

            return internals.guidRegex(guid, versions) ? ast.value : null;
        });
    }

    hex() {

        return this._test('string.hex', (ast) => {

            const hex = ast.value;

            return internals.hexRegex(hex) ? ast.value : null;
        });
    }

    email(opts) {

        opts = Joi.attempt(opts, InputSchemas.email);

        return this._test('string.email', (ast) => {

            try {

                const email = ast.value;
                const result = Isemail.validate(email, opts);

                if (result === true || result === 0) {
                    return email;
                }
            }
            catch (e) { }

            return null;
        });
    }

    uri(opts) {

        opts = Joi.attempt(opts, InputSchemas.uri);

        let customScheme = '';
        let allowRelative = false;
        let relativeOnly = false;
        let regex = internals.uriRegex;

        if (opts) {

            if (opts.scheme) {

                if (!Array.isArray(opts.scheme)) {

                    opts.scheme = [opts.scheme];
                }

                Hoek.assert(opts.scheme.length >= 1, 'scheme must have at least 1 scheme specified');

                for (const scheme of opts.scheme) {

                    Hoek.assert(scheme instanceof RegExp || typeof scheme === 'string', `${scheme} must be a RegExp or String`);

                    // Add OR separators if a value already exists
                    customScheme = customScheme + (customScheme ? '|' : '');

                    // If someone wants to match HTTP or HTTPS for example then we need to support both RegExp and String so we don't escape their pattern unknowingly
                    if (scheme instanceof RegExp) {

                        customScheme = customScheme + scheme.source;
                    }
                    else {

                        Hoek.assert(/[a-zA-Z][a-zA-Z0-9+-\.]*/.test(scheme), `${scheme}  must be a valid scheme`);
                        customScheme = customScheme + Hoek.escapeRegex(scheme);
                    }
                }
            }

            if (opts.allowRelative) {
                allowRelative = true;
            }

            if (opts.relativeOnly) {
                relativeOnly = true;
            }
        }

        if (customScheme || allowRelative || relativeOnly) {

            regex = Uri.createUriRegex(customScheme, allowRelative, relativeOnly);
        }

        return this._test('string.uri', (ast) => {

            if (regex.test(ast.value)) {

                return ast.value;
            }

            if (relativeOnly) {

                return new GraphQLError('value must be a valid relative uri');
            }

            if (customScheme) {

                return new GraphQLError(`value must be a valid uri with a scheme matching the ${customScheme} pattern`);
            }
        });
    }

    lowercase() {

        const obj = this._test('string.lowercase', (ast) => {

            const str = ast.value;

            if (this._options.convert || str === str.toLocaleLowerCase()) {

                return ast.value;
            }

            return null;
        });

        obj._flags.case = 'lower';
        return obj;
    }

    uppercase() {

        const obj = this._test('string.uppercase', (ast) => {

            const str = ast.value;

            if (this._options.convert || str === str.toLocaleUpperCase()) {

                return ast.value;
            }

            return null;
        });

        obj._flags.case = 'upper';
        return obj;
    }

    alphanum() {

        return this._test('string.alphanum', (ast) => {

            const string = ast.value;

            return internals.alphanumRegex(string) ? ast.value : null;
        });
    }

    token() {

        return this._test('string.token', (ast) => {

            const token = ast.value;

            return internals.tokenRegex(token) ? ast.value : null;
        });
    }

    base64(opts = {}) {

        opts = Joi.attempt(opts, InputSchemas.base64);

        return this._test('string.base64', (ast) => {

            return internals.base64Regex(ast.value, opts) ? ast.value : null;
        });
    }

    hostname() {

        return this._test('string.hostname', (ast) => {

            return internals.hostnameRegex(ast.value) ? ast.value : null;
        });
    }

    creditCard() {

        return this._test('string.creditCard', (ast) => {

            return internals.creditCard(ast.value) ? ast.value : null;
        });
    }

    trim() {

        return this._test('string.trim', (ast, options) => {

            if (options.convert || ast.value === ast.value.trim()) {

                if (ast.value === ast.value.trim()) {

                    return ast.value;
                }

                ast.value = ast.value.trim();

                return ast.value;

            }

            return null;
        });
    }

    regex(pattern, opts = {}) {

        pattern = Joi.attempt(pattern, InputSchemas.regex);
        opts = Joi.attempt(opts, InputSchemas.regexOpts);

        return this._test('string.regex', (ast) => {

            let errorMsg;

            const config = {
                pattern: new RegExp(pattern.source, pattern.ignoreCase ? 'i' : undefined),
                name: opts.name
            };

            const result = config.pattern.test(ast.value);

            if (result ^ opts.invert) {

                return ast.value;
            }

            if (opts.invert) {

                errorMsg = `value ${ast.value} matches the inverted ${opts.name ? opts.name + ' ' : ''}pattern: ${config.pattern}`;
            }
            else {
                errorMsg = `value ${ast.value} fails to match the required ${opts.name ? opts.name + ' ' : ''}pattern: ${config.pattern}`;
            }

            return new GraphQLError(errorMsg);
        });
    }
};

module.exports = function () {

    return new internals.StringScalar();
};
