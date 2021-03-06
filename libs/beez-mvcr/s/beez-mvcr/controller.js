/**
 * @fileOverview Controller/ControllerManager
 * @name controller.js<beez-mvcr>
 * @author Kei Funagayama <funagayama_kei@cyberagent.co.jp>
 */

(function (global) {

    define(function __Controller__(require, exports, module) {
        'use strict';

        var beez = require('beez.core');
        require('beez.mvcr');
        require('beez.i18n');

        var logger = beez.getLogger('beez.mvcr.controller');

        var _ = beez.vendor._;

        // -------------------
        // ControllerManagerAsync

        /**
         * Controller management class, asynchronous
         *
         * @class
         * @name ControllerManagerAsync
         * @private
         * @param {ControllerManager} manager
         * @extends {Bucks}
         */
        var ControllerManagerAsync = beez.Bucks.extend(
            'beez.mvcr.ControllerManagerAsync',
            {
                /**
                 * Constructor
                 *
                 * @memberof ControllerManagerAsync
                 * @instance
                 */
                initialize: function initialize(manager) {
                    this.manager = manager;
                },

                /**
                 * Generation of the Controller
                 *
                 * @memberof ControllerManagerAsync
                 * @instance
                 * @param {String} prefix
                 * @param {Controller|Array<Controller>} Controller Controller Object
                 * @param {Object|Array<Object>} [options] Arguments to the Controller
                 * @return {Controller}
                 */
                create: function create(name, Controller, options) {
                    var self = this;
                    return this.then(function createWrap(result, next) {

                        if (!Controller || typeof Controller !== 'function') {
                            throw new beez.Error('Controller does not exist / does not be funciton. Specified name: ' + name);
                        }
                        if (self.manager.controllers[name]) {
                            throw new beez.Error('It is a singleton in the module. name:' + name);
                        }

                        var controller = new Controller();
                        self.manager.controllers[name] = controller;
                        next(result, self.manager.controllers[name]);

                    }).then(function (controller, next) {
                        controller.loadCSS(function () { // initialize css load
                            next(null, controller);
                        });

                    }).then(function (controller, next) {
                        controller.loadI18n(function (err) { // initialize i18n load
                            if (err) {
                                logger.error('i18n load error. ', err.message);
                                logger.debug(err.stack);
                            }
                            next(err, controller);
                        });
                    });
                },

                /**
                 * Disposes of the instance
                 *
                 * @memberof ControllerManagerAsync
                 */
                dispose: function dispose() {
                    logger.trace(this.constructor.name, 'dispose');
                    delete this.manager;
                }
            }
        );

        // -------------------
        // ControllerManager

        /**
         * Controller management class.
         *
         * @class
         * @name ControllerManager
         */
        var ControllerManager = beez.extend(
            'beez.mvcr.ControllerManager',
            function constructor() {
                return this.initialize();
            },
            {
                /**
                 * Constructor
                 *
                 * @memberof ControllerManager
                 * @instance
                 */
                initialize: function initialize() {
                    this.controllers = {};
                },

                /**
                 * Generating ControllerManagerAsync
                 *
                 * @memberof ControllerManager
                 * @instance
                 * @return {ControllerAsync}
                 */
                async: function async() {
                    return new ControllerManagerAsync(this);
                },

                /**
                 * Remove controller
                 *
                 * @memberof ControllerManager
                 * @instance
                 * @param {String} name jsonPath name
                 * @return {ControllerManager}
                 */
                remove: function remove(name) {
                    var obj = this.get(name);
                    if (!obj) {
                        return this;
                    }
                    delete this.controllers[name];
                    return this;
                },

                /**
                 * From path, acquire Controller.
                 *
                 * @memberof ControllerManager
                 * @instance
                 * @param {String} name jsonPath name
                 * @return {Controller}
                 */
                get: function get(name) {
                    return this.controllers[name];
                },

                /**
                 * Disposes of the instance
                 *
                 * @memberof ControllerManager
                 * @instance
                 */
                dispose: function () {
                    logger.trace(this.constructor.name, 'dispose');
                    delete this.controllers;
                }
            });


        // -------------------
        // Controller

        /**
         * Controller class.
         *
         * @namespace beez.mvcr
         * @class
         * @name Controller
         */
        var Controller = beez.extend(
            'beez.mvcr.Controller',
            function constructor() {
                this.initialize.apply(this, arguments);
            },
            {
                constructor: function constructor() {

                    /**
                     * Management flag
                     * @memberof Controller
                     */
                    this.state = {
                        isBeforeOnce: false,
                        isAfterOnce: false
                    };

                    // call Backbone.contoller.constructor
                    Controller.__super__.constructor.apply(this, arguments);
                },

                /**
                 * Constructor
                 *
                 * @memberof Controller
                 * @instance
                 */
                initialize: function initialize() {
                },

                /**
                 * automatic loading of i18n data.
                 * @memberof Controller
                 * @param {function} callback
                 */
                i18n: function i18n() {},

                /**
                 * automatic loading of i18n.
                 *
                 * @memberof Controller
                 * @param {function} callback Completion callback
                 * @instance
                 * @return {Controller}
                 */
                loadI18n: function loadI18n(callback) {
                    if (!beez.i18n) {
                        beez.createI18n();
                    }

                    var self = this;
                    if (beez.utils.is('Object', this.i18n)) { // dynamic load

                        var langs = [];
                        var paths = [];
                        _.each(this.i18n, function (path, lang) {
                            langs.push(lang);
                            paths.push(path);
                        });

                        require(paths, function () {
                            var list = Array.prototype.slice.call(arguments);
                            for (var i = 0; i < list.length; i++) {
                                var data = {};
                                data[langs[i]] = list[i];
                                beez.i18n.add(data);
                                logger.debug('i18n file loaded. path:', paths[i]);
                            }
                            callback && callback(null);
                        }, function (err) {
                            callback && callback(err);
                        });

                    } else if (beez.utils.is('Function', this.i18n)) { // static load
                        new beez.Bucks()
                            .add(function (err, res, next) {
                                if (0 < self.i18n.length) {
                                    self.i18n(function (err, res) {
                                        next(err, res);
                                    });
                                } else {
                                    next(null, self.i18n());
                                }
                            })
                            .add(function (err, res) {
                                if (res) {
                                    beez.i18n.add(res);
                                }
                                callback && callback(err, res);
                            })
                            .end();

                    } else {
                        callback && callback(new Error('The Controller.i18n, please be defined in Function.'));
                    }
                    return this;

                },

                /**
                 * The function performed before a method is performed when a navigate function is performed. (only once)
                 * Until next runs to waiting after that function, to define a next as an argument, to delay the process.
                 *
                 * @memberof Controller
                 * @instance
                 * @function
                 * @param {Function} [next]
                 * @example
                 * beforeOnce: function beforeOnce(next) {
                 *     somethingAsync(function() {
                 *         next();
                 *     });
                 * }
                 *
                 */
                beforeOnce: beez.none,


                /**
                 * The function performed before a method is performed when a navigate function is performed.
                 * Until next runs to waiting after that function, to define a next as an argument, to delay the process.
                 *
                 * @memberof Controller
                 * @instance
                 * @function
                 * @param {Function} [next]
                 * @example
                 * before: function before(next) {
                 *     somethingAsync(function() {
                 *         next();
                 *     });
                 * }
                 *
                 */
                before: beez.none,

                /**
                 * Execute after this controller method performed.
                 * You can delay processes to give `next` in arugument, then processes made to be delayed untill for call `next`.
                 *
                 * @memberof View
                 * @instance
                 * @function
                 * @param {Function} [next]
                 * @example
                 * after: function after(next) {
                 *     somethingAsync(function() {
                 *         next();
                 *     });
                 * }
                 */
                after: beez.none,

                /**
                 * Execute once after this controller method performed.(only once)
                 * You can delay processes to give `next` in arugument, then processes made to be delayed untill for call `next`.
                 *
                 * @memberof View
                 * @instance
                 * @function
                 * @param {Function} [next]
                 * @example
                 * afterOnce: function afterOnce(next) {
                 *     somethingAsync(function() {
                 *         next();
                 *     });
                 * }
                 */
                afterOnce: beez.none,

                /**
                 * automatic loading of css.
                 *
                 * @memberof Controller
                 * @param {function} callback Completion callback
                 * @instance
                 * @return {Controller}
                 */
                loadCSS: function loadCSS(callback) {
                    var paths = this.css;
                    if (!paths || paths.length < 1) {
                        return callback && callback();
                    }

                    var self = this;
                    var tasks = _.map(paths, function task(p) {
                        return function t(err, res, next) {
                            beez.manager.css.async()
                                .load(p)
                                .end(function (err1, res1) {
                                    next(err, res1[0]);
                                }, function (err2) {
                                    next(err2);
                                });
                        };
                    });

                    var b = new beez.Bucks();
                    b.parallel(tasks)
                        .end(function (err, ress) {
                            callback && callback(err, ress);
                        });

                    return this;
                },

                /**
                 * Processing is performed by the flow of [beforeOnce -> before -> render -> after -> afterOnce].
                 *
                 * @memberof Controller
                 * @instance
                 * @private
                 * @param {String} name method name of controller
                 * @param {Array} parameter the paramter which will be passed to the method
                 * @param {Function} callback
                 */
                show: function show(name, parameter, callback) {
                    var self = this;
                    var job = new beez.Bucks();
                    var isAsync = beez.utils.isFunction(callback);
                    var _normalize = function (name, parameter, done) {
                        var method = self[name],
                            length = method.length,
                            args = _.clone(parameter);

                        if (length && isAsync) {
                            args[length - 1] = done;
                            method.apply(self, args);
                        } else {
                            method.apply(self, args);
                            done();
                        }
                    };

                    // call before once
                    if (!this.state.isBeforeOnce) {
                        job.then(function beforeOnce(res, next) {
                            _normalize('beforeOnce', parameter, function () {
                                self.state.isBeforeOnce = true;
                                next(null, self);
                            });
                        });
                    }
                    // call before
                    job.then(function before(res, next) {
                        _normalize('before', parameter, function () {
                            next(null, self);
                        });
                    });
                    // call method
                    job.then(function exec(res, next) {
                        _normalize(name, parameter, function () {
                            next(null, self);
                        });
                    });
                    // call after
                    job.then(function after(res, next) {
                        _normalize('after', parameter, function () {
                            next(null, self);
                        });
                    });
                    // call afterOnce
                    if (!this.state.isAfterOnce) {
                        job.then(function afterOnce(res, next) {
                            _normalize('afterOnce', parameter, function () {
                                self.state.isAfterOnce = true;
                                next(null, self);
                            });
                        });
                    }

                    // fire!!
                    job.end(function (err, ress) {
                        if (callback) {
                            callback(err, ress);
                        } else if (err) {
                            throw err;
                        }
                    });
                },

                /**
                 * Disposes of the instance
                 *
                 * @memberof Controller
                 */
                dispose: function dispose() {
                    logger.trace(this.constructor.name, 'dispose');
                    delete this.constructor.prototype.css;
                }
            }
        );


        /**
         * extend function
         *
         * @memberof Controller
         * @function
         * @param {String} [name] instance name
         * @param {Object} childProto prototypes
         * @borrows beez.extendThis as extend
         * @example
         * var MyController = Controller.extend(
         *     'myapp.MyController',
         *     {
         *         bar: function bar() {}
         *     }
         * );
         */
        Controller.extend = beez.extendThis;

        return {
            Controller: Controller,
            ControllerManager: ControllerManager,
            ControllerManagerAsync: ControllerManagerAsync
        };
    });
})(this);
