//import * as Papa from "/js/dist/papaparse.js";
//import "/js/dist/papaparse.min.js";
import "/js/dist/jszip.min.js";
//import { saveAs } from "/js/dist/FileSaver.min.js";

console.log(JSZip)

export function init_zip() {
    const zip = new JSZip();
    return zip;
}

export function zip_add_file(z, file, content) {
    return new Promise(resolve => {
        resolve(z.file(file, content));
    });
}

export function zip_helper(z, file, content) {
    return new Promise(resolve => {
        resolve(z.file(file, Papa.unparse(content)));
    });
}

export async function zip(z, file, content) {
    await zip_helper(z, file, content);
}

export function save_zip(zip, file) {
    zip.generateAsync({ type: "blob" }).then(function(content) {
        // see FileSaver.js
        saveAs(content, file);
    });
}

export function log(obj) {
    return dot_notate(obj);
}

function dot_notate(obj) {
    let target = {};
    dot_notate_helper(obj, target);
    target = { ...target };
    return target;
}

function dot_notate_helper(obj, target, prefix) {
    (target = target || {}), (prefix = prefix || "");

    Object.keys(obj).forEach(function(key) {
        if (typeof obj[key] === "object") {
            dot_notate_helper(obj[key], target, prefix + key + ".");
        } else {
            return (target[prefix + key] = obj[key]);
        }
    });

    return target;
}
