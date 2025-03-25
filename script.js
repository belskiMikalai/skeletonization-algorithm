
document.addEventListener('DOMContentLoaded', () => {
    const img_size = 300;
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    const img = new Image();
    img.src = 'img/img-placeholder.jpg';

    img.onload = () => {
        context.drawImage(img, 0, 0, img_size, img_size);
    };

    const inputElem = document.getElementById("input");
    const errorMsg = document.getElementById("errorMsg");
    inputElem.addEventListener("change", () => {
        errorMsg.textContent = '';
        if (inputElem.files.length == 0) {
            return;
        }
        let extension = inputElem.files[0].name.split('.').pop().toLowerCase();
        const reader = new FileReader();
        if (extension == 'csv') {
            reader.onload = (event) => {
                loadCSV(event.target.result, img_size, context, errorMsg);
            };
            reader.readAsText(inputElem.files[0]);
            return;
        }
        reader.onload = (event) => {
            const tempImg = new Image();
            tempImg.onload = (ev) => {
                context.drawImage(ev.target, 0, 0, img_size, img_size);
                let imgData = context.getImageData(0, 0, canvas.width, canvas.height);
                convertBinary(imgData.data);
                context.putImageData(imgData, 0, 0);
            };
            tempImg.src = event.target.result;
        };
        reader.readAsDataURL(inputElem.files[0]);
    });

    const but = document.getElementById('choose-img');
    but.addEventListener("click", (event) => {
        event.preventDefault();
        skeletonize(img_size, context);
    });

    let saveBut = document.getElementById('save-img');
    saveBut.addEventListener('click', (event) => {
        event.preventDefault();
        const selectElement = document.getElementById('file');
        const output = selectElement.options[selectElement.selectedIndex].value;
        if (output == 'png') {
            let canvasUrl = canvas.toDataURL('image/png');
            const createEl = document.createElement('a');
            createEl.href = canvasUrl;
            createEl.download = "result";
            createEl.click();
            createEl.remove();
        } else if (output == 'csv') {
            let imgData = context.getImageData(0, 0, canvas.width, canvas.height);
            tableToCSV(imgData.data, img_size)
        }
    });
});

function loadCSV(csvData, imgSize, context, errorMsg) {
    let height = csvData.match(/\n/g).length + 1;
    let width = (csvData.length + 2) / 3 / height;
    if (height > imgSize || width > imgSize) {
        errorMsg.textContent = "Превышен размер!(Макс:300x300)";
        return;
    }

    context.fillStyle = "white";
    context.fillRect(0, 0, imgSize, imgSize);
    let imgData = context.getImageData(0, 0, imgSize, imgSize);
    let data = imgData.data;

    let data_w = 0;
    let data_h = 0;
    for (let i = 0; i < height; i++) {
        for (let k = 0; k < width; k++) {
            let p = 255;
            let index = i * width * 3 + k * 3;
            if (csvData[index] == 1) {
                p = 0;
            }
            data[data_w] = data[data_w + 1] = data[data_w + 2] = p;
            data_w += 4;
        }
        data_h++;
        data_w = data_h * imgSize * 4;
    }
    context.putImageData(imgData, 0, 0);
}

function tableToCSV(data, img_size) {
    let csv_data = [];
    const width = img_size * 4;
    for (let i = 0; i < img_size; i++) {
        let csvrow = [];
        for (let k = 0; k < width; k += 4) {
            let p = data[i * width + k] == 0 ? '1' : '0';
            csvrow.push(p);
        }
        csv_data.push(csvrow.join(", "));
    }
    csv_data = csv_data.join('\r\n');
    downloadCSVFile(csv_data);
}



function downloadCSVFile(csv_data) {

    CSVFile = new Blob([csv_data], {
        type: "text/csv"
    });
    let temp_link = document.createElement('a');
    temp_link.download = "result.csv";
    let url = window.URL.createObjectURL(CSVFile);
    temp_link.href = url;
    temp_link.style.display = "none";
    document.body.appendChild(temp_link);
    temp_link.click();
    document.body.removeChild(temp_link);
}

function convertBinary(data) {
    for (let i = 0; i < data.length; i += 4) {
        let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        avg = (avg > 127) ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = avg;
    }
}

function skeletonize(imgSize, context) {
    const w = 4 * imgSize;
    let imgData = context.getImageData(0, 0, imgSize, imgSize);
    let data = imgData.data;
    let temp = data.slice();

    let count = 0;
    let isChanged = true;
    while (isChanged) {
        isChanged = false;
        step = count % 2;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] == 255) {
                continue;
            }
            const P_id = [i - w, i - w + 4, i + 4, i + w + 4, i + w, i + w - 4, i - 4, i - w - 4];
            const P = getArr(P_id, i, false);
            const [BP1, AP1] = check(P, i);
            if (!(step == 0 && BP1 >= 2 && BP1 <= 6 && AP1 == 1 && P[0] + P[2] + P[4] > 0 && P[6] + P[2] + P[4] > 0) &&
                !(step == 1 && BP1 >= 2 && BP1 <= 6 && AP1 == 1 && P[1] + P[2] + P[6] > 0 && P[6] + P[0] + P[4] > 0)) {
                continue;
            }
            if (BP1 == 2 && AP1 == 1) {
                let [BN4, AN4, BND, AND] = [0, 0, 0, 0];
                if (P[2] == 0) {
                    if (P[1] == 0) {
                        [BN4, AN4] = offsetCheck(4, i);
                        [BND, AND] = offsetCheck(4 - w, i);
                    } else if (P[3] == 0) {
                        [BN4, AN4] = offsetCheck(4, i);
                        [BND, AND] = offsetCheck(4 + w, i);
                    }
                } else if (P[0] == 0) {
                    if (P[1] == 0) {
                        [BN4, AN4] = offsetCheck(-w, i);
                        [BND, AND] = offsetCheck(-w + 4, i);
                    } else if (P[7] == 0) {
                        [BN4, AN4] = offsetCheck(-w, i);
                        [BND, AND] = offsetCheck(-w - 4, i);
                    }
                } else if (P[6] == 0) {
                    if (P[7] == 0) {
                        [BN4, AN4] = offsetCheck(-4, i);
                        [BND, AND] = offsetCheck(-4 - w, i);
                    } else if (P[5] == 0) {
                        [BN4, AN4] = offsetCheck(-4, i);
                        [BND, AND] = offsetCheck(-4 + w, i);
                    }
                } else if (P[4] == 0) {
                    if (P[5] == 0) {
                        [BN4, AN4] = offsetCheck(w, i);
                        [BND, AND] = offsetCheck(w - 4, i);
                    } else if (P[3] == 0) {
                        [BN4, AN4] = offsetCheck(w, i);
                        [BND, AND] = offsetCheck(w + 4, i);
                    }
                }
                if (BN4 == 3 && AN4 == 2 && BND == 4 && AND == 2) {
                    continue;
                }
            }
            else if (BP1 == 3 && AP1 == 1) {
                const exP_id = P_id.concat([i - w + 8, i + 8, i + w + 8, i + 2 * w + 8, i + 2 * w + 4, i + 2 * w, i + 2 * w - 4]);
                const exP = getArr(exP_id, i, false);
                let sum = true;
                for (let k = 8; k < 15; k++) {
                    if (exP[k] == 0) {
                        sum = false;
                        break;
                    }
                }
                if (P[2] + P[4] == 0 && sum) {
                    continue;
                }
            }
            del(i);
            isChanged = true;
        }
        count++;
        update();
    }

    const T = [
        [['1', 'Xd', 'Xe', '0', 'Xe', 'Xd', '1', 'Y', '1'], ['1', 'Y', '1', 'Xd', 'Xe', '0', 'Xe', 'Xd', '1']],
        [['Xe', '0', 'Xe', 'Xd', '1', 'Y', '1', 'Xd', '1'], ['Xe', 'Xd', '1', 'Y', '1', 'Xd', 'Xe', '0', '1']]
    ];
    for (let n = 0; n < 2; n++) {
        isChanged = true;
        while (isChanged) {
            isChanged = false;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] == 0 && checkTemplates(i, T[n])) {
                    isChanged = true;
                    del(i);
                }
            }
            update();
        }
    }

    function del(i) {
        temp[i] = temp[i + 1] = temp[i + 2] = 255;
    }
    function update() {
        data.set(temp);
        context.putImageData(imgData, 0, 0);
    }
    function getArr(arrId, i, post) {
        let arr = [];
        for (let k = 0; k < arrId.length; k++) {
            let value = 0;
            if (arrId[k] < 0 || arrId[k] >= data.length ||
                (k > 4 && k < 8 && i % w == 0) ||
                (((k > 0 && k < 4) || (!post && (k > 7 && k < 13))) && (i % w == w - 4)) ||
                ((!post && (k > 7 && k < 13)) && (i % w == w - 8))) {
                value = 255;
            } else {
                value = data[arrId[k]];
            }
            arr.push(value);
        }
        return arr;
    }
    function check(arr, i) {
        let B = 0;
        let A = 0;
        let is_wh = arr[arr.length - 1] == 255;
        for (p of arr) {
            if (p == 0) {
                B++;
                if (is_wh) {
                    A++;
                }
                is_wh = false;
            } else {
                is_wh = true;
            }
        }
        return [B, A];
    }
    function offsetCheck(offset, i) {
        const P_id = [i - w + offset, i - w + 4 + offset, i + 4 + offset, i + w + 4 + offset, i + w + offset, i + w - 4 + offset, i - 4 + offset, i - w - 4 + offset];
        const P = getArr(P_id, i + offset, false);
        return check(P, i);
    }
    function checkTemplates(i, T) {
        const M_id = [i - w, i - w + 4, i + 4, i + w + 4, i + w, i + w - 4, i - 4, i - w - 4, i];
        const M = getArr(M_id, i, true);
        let remove = false;
        for (let k = 0; k < 2; k++) {
            let condition = true;
            let Xeb = 0;
            let Xdf = 0;
            for (let j = 0; j < 9; j++) {
                let p = T[k][j];
                let p_data = M[j];
                if ((p == '1' && p_data != 0) || (p == '0' && p_data != 255)) {
                    condition = false;
                    break;
                } else if (p == 'Xe' && p_data == 255) {
                    Xeb++;
                } else if (p == 'Xd' && p_data == 0) {
                    Xdf++;
                }
            }
            if (condition && (Xeb == 2 || (Xeb == 1 && Xdf >= 1))) {
                remove = true;
                break;
            }
        }
        return remove;
    }
}