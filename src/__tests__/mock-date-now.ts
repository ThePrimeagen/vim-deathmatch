let dateNow = 0;
jest.mock("../now", function() {
    return {
        default: function() {
            return dateNow;
        }
    };
});

export function incrementTime(amount: number) {
    dateNow += amount;
};

export function reset() {
    dateNow = 0;
}


