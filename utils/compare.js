module.exports = {
    comparePoints: (objA, objB) => (objA.points < objB.points) ? -1 : (objA.points > objB.points) ? 1 : 0,
};