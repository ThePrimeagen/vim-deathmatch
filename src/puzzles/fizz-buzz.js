module.exports.start = function() {
    const fizz = () => {
        for (let i = 0; i < 100; ++i) {
            console.log(str.length === 0 ? i : str);
        }
    };

    return fizz;
};

module.exports.end = function() {
    return function() {
        for (let i = 0; i < 100; ++i) {
            console.log(str || i);
        }
    };
};
