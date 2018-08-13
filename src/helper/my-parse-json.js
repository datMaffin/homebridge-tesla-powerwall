/**
 * Parse JSON string into an object
 *
 * @param {string} str String in JSON form.
 */
module.exports = function(str) {
    var obj = null;
    try {
        obj =  JSON.parse(str);
    } catch(e) {
        obj = null;
    }
    return obj;
};
