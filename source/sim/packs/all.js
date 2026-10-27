// Node: load every pack, in order (the browser build inlines the same files in the same order)
const P = require('./registry.js');
require('./eras/napoleonic.js'); require('./eras/medieval-test.js'); require('./nations/napoleonic.js'); require('./leaders/napoleonic.js'); require('./maps/toy-ridge.js'); require('./oob/toy-ridge.js'); require('./battles/waterloo.js'); require('./battles/toy-ridge.js');
module.exports = P;
