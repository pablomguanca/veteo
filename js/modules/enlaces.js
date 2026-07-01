export const ENLACES_APP = {
    pch: "http://10.94.164.15:16000/pch/app/login",
    ultimaMilla: "https://docs.google.com/forms/d/1dGuyCKKq8ypnkzTzs94OL1KvPKBUFwgMPf0BlQ-ZwOw/edit?ts=6824aec7",
    formPas: "https://docs.google.com/forms/d/e/1FAIpQLSduF5W6fBCrrCTkrMCnPrUgxNSjAE1_VWY3p9c5xVqFf5xM9Q/viewform",
    accEspeciales: "https://docs.google.com/forms/d/e/1FAIpQLSecPY7Wynn_Jqn8rob6F4IY61wLne3fsA_MjnQHiS8_ddMVAw/viewform",
    formPft: "https://carrefour.impactover.de/",
    formPftCarnes: "https://docs.google.com/forms/d/e/1FAIpQLSf-CTbqd4yQvpdO4RAcTADvK_bJnGmjKIE_ScBcObHvHQDfJQ/viewform",
    formCalidad: "https://docs.google.com/forms/d/1fp8DSPQXZp4wLWMydEnl9AK0dhzxgAfXBoElKmznwy0/edit",
    formMolinos: "https://docs.google.com/forms/d/1QtVfHGiP6rQSxxBQY_02PPSiKDGx34Azu_KyCKMUwsY/edit",
    formLevex: "https://docs.google.com/forms/d/1Lczahs1wzg86pH5FM5Bv6t1ECnoOuG8Eqcz8upZ0aaQ/edit",
    formRescates: "https://docs.google.com/forms/d/1ubgiquX6jyMXHAtJbv6UA0OgEs3XphRSefqV9pkTWck/edit"
};

export function inicializarEnlaces() {
    const elementos = document.querySelectorAll('[data-link]');

    elementos.forEach(elemento => {
        const identificador = elemento.getAttribute('data-link');
        if (ENLACES_APP[identificador]) {
            elemento.href = ENLACES_APP[identificador];
        }
    });
}