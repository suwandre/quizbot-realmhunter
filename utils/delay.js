module.exports = {
    /**
     *
     * @param {Number} time the timeout delay in milliseconds.
     * @returns a void promise that resolves after the specified time.
     */
    delay: (time) => new Promise(resolve => setTimeout(resolve, time)),
};