
let rates;
fetch('https://api.fixer.io/latest')
    .then((response) => {
        if(response.ok) { return response.json();
        }
        throw new Error('Conversion rates could not be reached. Try again later');
    })
    .then((data) => {
        rates = data.rates;
        rates["EUR"] = 1;
        // return rates;
    });



class CurrencyConverter extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {

        let elementsObject = {};

        // Conver amount from - input:
        this.shadow = this.attachShadow({ mode: 'open' });
        const shadowRoot = this.shadow;

        // CSS style:
        shadowRoot.innerHTML = `
            <style>
                h1 {
                    margin: 0 5% 2%;
                    font-family: 'Raleway-Bold', sans-serif;
                    font-size: 20px;
                    font-weight: 700;
                }
                p {
                    margin: 0 5% 2%;
                }
                input[type=text] {
                    width: 50%;
                    border-radius: 8px;
                    display: inline-block;
                    padding: 2% 2%;
                    margin: 0 5%;
                    font-family: 'Raleway-Regular', sans-serif;
                }
                input:disabled {
                    font-family: 'Raleway-Bold', sans-serif;
                    color: #000;
                    font-weight: 700;
                }
                select {
                    width: 20%;
                    margin: 0 2% 5%;
                    height: 30px;
                }

                #disclaimer-container {
                    float: right;
                    font-family: 'Raleway-MediumItalic', sans-serif;
                    font-weight: 500;
                    font-style: italic;
                }
            </style>
        `;

        function renderElement(parentNode, elementNameString, tagString, propertyObject) {
            const element = document.createElement(tagString);
            for (const property in propertyObject) {
                element[property] = propertyObject[property];
            }
            parentNode.appendChild(element);

            elementsObject[elementNameString] = element;
        }

        renderElement(shadowRoot, 'heading', 'h1', {
            'innerHTML': 'Currency converter'
        });

        renderElement(shadowRoot, 'instruction', 'p', {
            'innerHTML': 'Type in amount and select currency:'
        });

        renderElement(shadowRoot, 'amountFromInput', 'input', {
            'type': 'text'
        });


        // Conver currency from - select:
        const currencySelectOptions = `
            <option value="CAD" selected>CAD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>`;

        renderElement(shadowRoot, 'currencyFromSelect', 'select', {
            'innerHTML': currencySelectOptions
        });

        renderElement(shadowRoot, 'resultHeading', 'p', {
            'innerHTML': 'Converted amount:'
        });


        // Conver amount to - input:
        renderElement(shadowRoot, 'amountToInput', 'input', {
            'type': 'text',
            'disabled': true
        });

        // Conver currency to - select:
        renderElement(shadowRoot, 'currencyToSelect', 'select', {
            'innerHTML': currencySelectOptions
        });

        // Disclaimer:
        const disclaimerDiv = document.createElement('div');
        disclaimerDiv.id = 'disclaimer-container';

        renderElement(disclaimerDiv, 'disclaimer', 'a', {
            'href': 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
            'target': '_blank',
            'innerHTML': 'Disclaimer',
            'id': 'disclaimer'
        });

        shadowRoot.appendChild(disclaimerDiv);

        elementsObject.amountFromInput.addEventListener('input', changeCallback );
        elementsObject.currencyFromSelect.addEventListener('change', changeCallback );
        elementsObject.currencyToSelect.addEventListener('change', changeCallback);

        function changeCallback() {
            const alphabetRemoved = elementsObject.amountFromInput.value.replace(/[^\d+.]/g, "");
            elementsObject.amountFromInput.value = alphabetRemoved.match(/\d*\.?\d{0,2}/);
            const amountTo = getConvertedAmount();
            elementsObject.amountToInput.value = Math.round(amountTo * 100) / 100;
        };

        function getConvertedAmount() {
            return elementsObject.amountFromInput.value * rates[elementsObject.currencyToSelect.value] / rates[elementsObject.currencyFromSelect.value];
        }
    }

}

window.customElements.define('currency-converter', CurrencyConverter);