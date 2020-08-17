function fizzbuzzStart() {
    return function fizzbuzz(dataMap, count) {
        for (let i = 0; i < count; ++i) {
            let str = "";
            for (const k in dataMap.keys()) {
                const v = dataMap[k];
                if (i % v) {
                    str += k;
                }
            }

            if (str) {
                console(str);
            }
        }
    }.toString();
}

function fizzbuzzEnd() {
    return function fizzbuzz(dataMap, count) {
        for (let i = 0; i < count; ++i) {
            let str = "";
            for (const [k, v] of Object.entries(dataMap)) {
                if (i % v === 0) {
                    str += k;
                }
            }

            if (str) {
                console.log(str);
            }
            else {
                console.log(i);
            }
        }
    }.toString();
}

export default function create(): [string, string] {
    return [fizzbuzzStart(), fizzbuzzEnd()];
};
