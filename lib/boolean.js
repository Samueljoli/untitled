'use strict';

const Base = require('./base');
const Hoek = require('hoek');
const { Kind, GraphQLError } = require('graphql');

// Declare internals

const internals = {};

internals.defaults = {
    name        : 'BooleanScalar',
    serialize   : Function,
    parseLiteral: Function,
    parseValue  : Function
};

internals.configDefaults = {
    convert: true
};

internals.BooleanScalar = function BooleanScalar() {

    if (BooleanScalar._instance) { // Enforce singleton

        BooleanScalar._instance._allowed = [];
        BooleanScalar._instance._disallowed = [];
        BooleanScalar._instance._defaultValue = null;
        BooleanScalar._instance._isBinary = false;
        BooleanScalar._instance._options = Hoek.clone(internals.configDefaults);

        return BooleanScalar._instance;
    }

    this._allowed = [];
    this._disallowed = [];
    this._defaultValue = null;
    this._isBinary = false;
    this._options = Hoek.clone(internals.configDefaults);

    BooleanScalar._instance = this;

    Base.call(this, internals.defaults);
};

Hoek.inherits(internals.BooleanScalar, Base);

Hoek.merge(internals.BooleanScalar.prototype, {

    parseLiteral(ast) {

        if (this._defaultValue && !ast) { //TODO: Check for ast.value?

            return this._defaultValue;
        }

        if (ast.kind !== Kind.BOOLEAN && !this._isBinary) {

            const msg = `KindError: expected ${Kind.BOOLEAN}, but got ${ast.kind}`;
            throw new GraphQLError(msg);
        }

        if (this._isBinary) {

            if (typeof ast.value === 'number') {

                ast.value = ast.value === 1 ? true : false;

                return this.validate(ast);
            }

            if (this._options.convert) {

                if (typeof ast.value === 'string') {

                    const newVal = parseInt(ast.value);

                    ast.value = newVal === 1 ? true : false;

                    return this.validate(ast);
                }

                throw new GraphQLError('TODO');

            }

            throw new GraphQLError('TODO');
        }

        return this.validate(ast);
    },

    truthy() {

        return this._test('boolean.truthy', (ast) => {

            return ast.value === true;
        });
    },

    falsy() {

        return this._test('boolean.falsy', (ast) => {

            return ast.value === false;
        });
    },

    indifferent() {

        return this._test('boolean.indifferent', (ast) => {

            return true;
        });
    },

    binary() {

        const obj = this._clone();
        obj._isBinary = true;

        return obj;
    }
});

module.exports = function () {

    return new internals.BooleanScalar();
};