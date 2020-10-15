export const start = function() {
    const fizz = () => {
        for (let i = 0; i < 100; ++i) {
            let str = "";
            if (i % 3 === 0) {
                str += "fizz";
            }
            if (i % 5 === 0) {
                str += "buzz";
            }
            console.log(str.length === 0 ? i : str);
        }
    };

    return fizz;
};

export const end = function() {
    return function() {
        for (let i = 0; i < 100; ++i) {
            let str = "";
            if (i % 3 === 0) {
                str += "fizz";
            }
            if (i % 5 === 0) {
                str += "buzz";
            }
            console.log(str || i);
        }
    };
};
