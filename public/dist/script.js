'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

/**
 * This shim allows elements written in, or compiled to, ES5 to work on native
 * implementations of Custom Elements.
 *
 * ES5-style classes don't work with native Custom Elements because the
 * HTMLElement constructor uses the value of `new.target` to look up the custom
 * element definition for the currently called constructor. `new.target` is only
 * set when `new` is called and is only propagated via super() calls. super()
 * is not emulatable in ES5. The pattern of `SuperClass.call(this)`` only works
 * when extending other ES5-style classes, and does not propagate `new.target`.
 *
 * This shim allows the native HTMLElement constructor to work by generating and
 * registering a stand-in class instead of the users custom element class. This
 * stand-in class's constructor has an actual call to super().
 * `customElements.define()` and `customElements.get()` are both overridden to
 * hide this stand-in class from users.
 *
 * In order to create instance of the user-defined class, rather than the stand
 * in, the stand-in's constructor swizzles its instances prototype and invokes
 * the user-defined constructor. When the user-defined constructor is called
 * directly it creates an instance of the stand-in class to get a real extension
 * of HTMLElement and returns that.
 *
 * There are two important constructors: A patched HTMLElement constructor, and
 * the StandInElement constructor. They both will be called to create an element
 * but which is called first depends on whether the browser creates the element
 * or the user-defined constructor is called directly. The variables
 * `browserConstruction` and `userConstruction` control the flow between the
 * two constructors.
 *
 * This shim should be better than forcing the polyfill because:
 *   1. It's smaller
 *   2. All reaction timings are the same as native (mostly synchronous)
 *   3. All reaction triggering DOM operations are automatically supported
 *
 * There are some restrictions and requirements on ES5 constructors:
 *   1. All constructors in a inheritance hierarchy must be ES5-style, so that
 *      they can be called with Function.call(). This effectively means that the
 *      whole application must be compiled to ES5.
 *   2. Constructors must return the value of the emulated super() call. Like
 *      `return SuperClass.call(this)`
 *   3. The `this` reference should not be used before the emulated super() call
 *      just like `this` is illegal to use before super() in ES6.
 *   4. Constructors should not create other custom elements before the emulated
 *      super() call. This is the same restriction as with native custom
 *      elements.
 *
 *  Compiling valid class-based custom elements to ES5 will satisfy these
 *  requirements with the latest version of popular transpilers.
 */
(function () {
  'use strict';

  // Do nothing if `customElements` does not exist.

  if (!window.customElements) return;

  var NativeHTMLElement = window.HTMLElement;
  var nativeDefine = window.customElements.define;
  var nativeGet = window.customElements.get;

  /**
   * Map of user-provided constructors to tag names.
   *
   * @type {Map<Function, string>}
   */
  var tagnameByConstructor = new Map();

  /**
   * Map of tag names to user-provided constructors.
   *
   * @type {Map<string, Function>}
   */
  var constructorByTagname = new Map();

  /**
   * Whether the constructors are being called by a browser process, ie parsing
   * or createElement.
   */
  var browserConstruction = false;

  /**
   * Whether the constructors are being called by a user-space process, ie
   * calling an element constructor.
   */
  var userConstruction = false;

  window.HTMLElement = function () {
    if (!browserConstruction) {
      var tagname = tagnameByConstructor.get(this.constructor);
      var fakeClass = nativeGet.call(window.customElements, tagname);

      // Make sure that the fake constructor doesn't call back to this constructor
      userConstruction = true;
      var instance = new fakeClass();
      return instance;
    }
    // Else do nothing. This will be reached by ES5-style classes doing
    // HTMLElement.call() during initialization
    browserConstruction = false;
  };
  // By setting the patched HTMLElement's prototype property to the native
  // HTMLElement's prototype we make sure that:
  //     document.createElement('a') instanceof HTMLElement
  // works because instanceof uses HTMLElement.prototype, which is on the
  // ptototype chain of built-in elements.
  window.HTMLElement.prototype = NativeHTMLElement.prototype;

  var define = function define(tagname, elementClass) {
    var elementProto = elementClass.prototype;
    var StandInElement = function (_NativeHTMLElement) {
      _inherits(StandInElement, _NativeHTMLElement);

      function StandInElement() {
        _classCallCheck(this, StandInElement);

        // The prototype will be wrong up because the browser used our fake
        // class, so fix it:
        var _this = _possibleConstructorReturn(this, (StandInElement.__proto__ || Object.getPrototypeOf(StandInElement)).call(this));
        // Call the native HTMLElement constructor, this gives us the
        // under-construction instance as `this`:


        Object.setPrototypeOf(_this, elementProto);

        if (!userConstruction) {
          // Make sure that user-defined constructor bottom's out to a do-nothing
          // HTMLElement() call
          browserConstruction = true;
          // Call the user-defined constructor on our instance:
          elementClass.call(_this);
        }
        userConstruction = false;
        return _this;
      }

      return StandInElement;
    }(NativeHTMLElement);
    var standInProto = StandInElement.prototype;
    StandInElement.observedAttributes = elementClass.observedAttributes;
    standInProto.connectedCallback = elementProto.connectedCallback;
    standInProto.disconnectedCallback = elementProto.disconnectedCallback;
    standInProto.attributeChangedCallback = elementProto.attributeChangedCallback;
    standInProto.adoptedCallback = elementProto.adoptedCallback;

    tagnameByConstructor.set(elementClass, tagname);
    constructorByTagname.set(tagname, elementClass);
    nativeDefine.call(window.customElements, tagname, StandInElement);
  };

  var get = function get(tagname) {
    return constructorByTagname.get(tagname);
  };

  // Workaround for Safari bug where patching customElements can be lost, likely
  // due to native wrapper garbage collection issue
  Object.defineProperty(window, 'customElements', { value: window.customElements, configurable: true, writable: true });
  Object.defineProperty(window.customElements, 'define', { value: define, configurable: true, writable: true });
  Object.defineProperty(window.customElements, 'get', { value: get, configurable: true, writable: true });
})();
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var rates = void 0;
fetch('https://api.fixer.io/latest').then(function (response) {
    if (response.ok) {
        return response.json();
    }
    throw new Error('Conversion rates could not be reached. Try again later');
}).then(function (data) {
    rates = data.rates;
    rates["EUR"] = 1;
    // return rates;
});

var CurrencyConverter = function (_HTMLElement) {
    _inherits(CurrencyConverter, _HTMLElement);

    function CurrencyConverter() {
        _classCallCheck(this, CurrencyConverter);

        return _possibleConstructorReturn(this, (CurrencyConverter.__proto__ || Object.getPrototypeOf(CurrencyConverter)).call(this));
    }

    _createClass(CurrencyConverter, [{
        key: 'connectedCallback',
        value: function connectedCallback() {

            var elementsObject = {};

            // Conver amount from - input:
            this.shadow = this.attachShadow({ mode: 'open' });
            var shadowRoot = this.shadow;

            // CSS style:
            shadowRoot.innerHTML = '\n            <style>\n                h1 {\n                    margin: 0 5% 2%;\n                    font-family: \'Raleway-Bold\', sans-serif;\n                    font-size: 20px;\n                    font-weight: 700;\n                }\n                p {\n                    margin: 0 5% 2%;\n                }\n                input[type=text] {\n                    width: 50%;\n                    border-radius: 8px;\n                    display: inline-block;\n                    padding: 2% 2%;\n                    margin: 0 5%;\n                    font-family: \'Raleway-Regular\', sans-serif;\n                }\n                input:disabled {\n                    font-family: \'Raleway-Bold\', sans-serif;\n                    color: #000;\n                    font-weight: 700;\n                }\n                select {\n                    width: 20%;\n                    margin: 0 2% 5%;\n                    height: 30px;\n                }\n\n                #disclaimer-container {\n                    float: right;\n                    font-family: \'Raleway-MediumItalic\', sans-serif;\n                    font-weight: 500;\n                    font-style: italic;\n                }\n            </style>\n        ';

            function renderElement(parentNode, elementNameString, tagString, propertyObject) {
                var element = document.createElement(tagString);
                for (var property in propertyObject) {
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
            var currencySelectOptions = '\n            <option value="CAD" selected>CAD</option>\n            <option value="USD">USD</option>\n            <option value="EUR">EUR</option>';

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
            var disclaimerDiv = document.createElement('div');
            disclaimerDiv.id = 'disclaimer-container';

            renderElement(disclaimerDiv, 'disclaimer', 'a', {
                'href': 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
                'target': '_blank',
                'innerHTML': 'Disclaimer',
                'id': 'disclaimer'
            });

            shadowRoot.appendChild(disclaimerDiv);

            elementsObject.amountFromInput.addEventListener('input', changeCallback);
            elementsObject.currencyFromSelect.addEventListener('change', changeCallback);
            elementsObject.currencyToSelect.addEventListener('change', changeCallback);

            function changeCallback() {
                var alphabetRemoved = elementsObject.amountFromInput.value.replace(/[^\d+.]/g, "");
                elementsObject.amountFromInput.value = alphabetRemoved.match(/\d*\.?\d{0,2}/);
                var amountTo = getConvertedAmount();
                elementsObject.amountToInput.value = Math.round(amountTo * 100) / 100;
            };

            function getConvertedAmount() {
                return elementsObject.amountFromInput.value * rates[elementsObject.currencyToSelect.value] / rates[elementsObject.currencyFromSelect.value];
            }
        }
    }]);

    return CurrencyConverter;
}(HTMLElement);

window.customElements.define('currency-converter', CurrencyConverter);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5hdGl2ZS1zaGltLmpzIiwic2NyaXB0LmpzIl0sIm5hbWVzIjpbIndpbmRvdyIsImN1c3RvbUVsZW1lbnRzIiwiTmF0aXZlSFRNTEVsZW1lbnQiLCJIVE1MRWxlbWVudCIsIm5hdGl2ZURlZmluZSIsImRlZmluZSIsIm5hdGl2ZUdldCIsImdldCIsInRhZ25hbWVCeUNvbnN0cnVjdG9yIiwiTWFwIiwiY29uc3RydWN0b3JCeVRhZ25hbWUiLCJicm93c2VyQ29uc3RydWN0aW9uIiwidXNlckNvbnN0cnVjdGlvbiIsInRhZ25hbWUiLCJjb25zdHJ1Y3RvciIsImZha2VDbGFzcyIsImNhbGwiLCJpbnN0YW5jZSIsInByb3RvdHlwZSIsImVsZW1lbnRDbGFzcyIsImVsZW1lbnRQcm90byIsIlN0YW5kSW5FbGVtZW50IiwiT2JqZWN0Iiwic2V0UHJvdG90eXBlT2YiLCJzdGFuZEluUHJvdG8iLCJvYnNlcnZlZEF0dHJpYnV0ZXMiLCJjb25uZWN0ZWRDYWxsYmFjayIsImRpc2Nvbm5lY3RlZENhbGxiYWNrIiwiYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrIiwiYWRvcHRlZENhbGxiYWNrIiwic2V0IiwiZGVmaW5lUHJvcGVydHkiLCJ2YWx1ZSIsImNvbmZpZ3VyYWJsZSIsIndyaXRhYmxlIiwicmF0ZXMiLCJmZXRjaCIsInRoZW4iLCJyZXNwb25zZSIsIm9rIiwianNvbiIsIkVycm9yIiwiZGF0YSIsIkN1cnJlbmN5Q29udmVydGVyIiwiZWxlbWVudHNPYmplY3QiLCJzaGFkb3ciLCJhdHRhY2hTaGFkb3ciLCJtb2RlIiwic2hhZG93Um9vdCIsImlubmVySFRNTCIsInJlbmRlckVsZW1lbnQiLCJwYXJlbnROb2RlIiwiZWxlbWVudE5hbWVTdHJpbmciLCJ0YWdTdHJpbmciLCJwcm9wZXJ0eU9iamVjdCIsImVsZW1lbnQiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJwcm9wZXJ0eSIsImFwcGVuZENoaWxkIiwiY3VycmVuY3lTZWxlY3RPcHRpb25zIiwiZGlzY2xhaW1lckRpdiIsImlkIiwiYW1vdW50RnJvbUlucHV0IiwiYWRkRXZlbnRMaXN0ZW5lciIsImNoYW5nZUNhbGxiYWNrIiwiY3VycmVuY3lGcm9tU2VsZWN0IiwiY3VycmVuY3lUb1NlbGVjdCIsImFscGhhYmV0UmVtb3ZlZCIsInJlcGxhY2UiLCJtYXRjaCIsImFtb3VudFRvIiwiZ2V0Q29udmVydGVkQW1vdW50IiwiYW1vdW50VG9JbnB1dCIsIk1hdGgiLCJyb3VuZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7OztBQVVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWtEQSxDQUFDLFlBQU07QUFDTDs7QUFFQTs7QUFDQSxNQUFJLENBQUNBLE9BQU9DLGNBQVosRUFBNEI7O0FBRTVCLE1BQU1DLG9CQUFvQkYsT0FBT0csV0FBakM7QUFDQSxNQUFNQyxlQUFlSixPQUFPQyxjQUFQLENBQXNCSSxNQUEzQztBQUNBLE1BQU1DLFlBQVlOLE9BQU9DLGNBQVAsQ0FBc0JNLEdBQXhDOztBQUVBOzs7OztBQUtBLE1BQU1DLHVCQUF1QixJQUFJQyxHQUFKLEVBQTdCOztBQUVBOzs7OztBQUtBLE1BQU1DLHVCQUF1QixJQUFJRCxHQUFKLEVBQTdCOztBQUdBOzs7O0FBSUEsTUFBSUUsc0JBQXNCLEtBQTFCOztBQUVBOzs7O0FBSUEsTUFBSUMsbUJBQW1CLEtBQXZCOztBQUVBWixTQUFPRyxXQUFQLEdBQXFCLFlBQVk7QUFDL0IsUUFBSSxDQUFDUSxtQkFBTCxFQUEwQjtBQUN4QixVQUFNRSxVQUFVTCxxQkFBcUJELEdBQXJCLENBQXlCLEtBQUtPLFdBQTlCLENBQWhCO0FBQ0EsVUFBTUMsWUFBWVQsVUFBVVUsSUFBVixDQUFlaEIsT0FBT0MsY0FBdEIsRUFBc0NZLE9BQXRDLENBQWxCOztBQUVBO0FBQ0FELHlCQUFtQixJQUFuQjtBQUNBLFVBQU1LLFdBQVcsSUFBS0YsU0FBTCxFQUFqQjtBQUNBLGFBQU9FLFFBQVA7QUFDRDtBQUNEO0FBQ0E7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Y3JpcHQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTYgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cblxuLyoqXG4gKiBUaGlzIHNoaW0gYWxsb3dzIGVsZW1lbnRzIHdyaXR0ZW4gaW4sIG9yIGNvbXBpbGVkIHRvLCBFUzUgdG8gd29yayBvbiBuYXRpdmVcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBDdXN0b20gRWxlbWVudHMuXG4gKlxuICogRVM1LXN0eWxlIGNsYXNzZXMgZG9uJ3Qgd29yayB3aXRoIG5hdGl2ZSBDdXN0b20gRWxlbWVudHMgYmVjYXVzZSB0aGVcbiAqIEhUTUxFbGVtZW50IGNvbnN0cnVjdG9yIHVzZXMgdGhlIHZhbHVlIG9mIGBuZXcudGFyZ2V0YCB0byBsb29rIHVwIHRoZSBjdXN0b21cbiAqIGVsZW1lbnQgZGVmaW5pdGlvbiBmb3IgdGhlIGN1cnJlbnRseSBjYWxsZWQgY29uc3RydWN0b3IuIGBuZXcudGFyZ2V0YCBpcyBvbmx5XG4gKiBzZXQgd2hlbiBgbmV3YCBpcyBjYWxsZWQgYW5kIGlzIG9ubHkgcHJvcGFnYXRlZCB2aWEgc3VwZXIoKSBjYWxscy4gc3VwZXIoKVxuICogaXMgbm90IGVtdWxhdGFibGUgaW4gRVM1LiBUaGUgcGF0dGVybiBvZiBgU3VwZXJDbGFzcy5jYWxsKHRoaXMpYGAgb25seSB3b3Jrc1xuICogd2hlbiBleHRlbmRpbmcgb3RoZXIgRVM1LXN0eWxlIGNsYXNzZXMsIGFuZCBkb2VzIG5vdCBwcm9wYWdhdGUgYG5ldy50YXJnZXRgLlxuICpcbiAqIFRoaXMgc2hpbSBhbGxvd3MgdGhlIG5hdGl2ZSBIVE1MRWxlbWVudCBjb25zdHJ1Y3RvciB0byB3b3JrIGJ5IGdlbmVyYXRpbmcgYW5kXG4gKiByZWdpc3RlcmluZyBhIHN0YW5kLWluIGNsYXNzIGluc3RlYWQgb2YgdGhlIHVzZXJzIGN1c3RvbSBlbGVtZW50IGNsYXNzLiBUaGlzXG4gKiBzdGFuZC1pbiBjbGFzcydzIGNvbnN0cnVjdG9yIGhhcyBhbiBhY3R1YWwgY2FsbCB0byBzdXBlcigpLlxuICogYGN1c3RvbUVsZW1lbnRzLmRlZmluZSgpYCBhbmQgYGN1c3RvbUVsZW1lbnRzLmdldCgpYCBhcmUgYm90aCBvdmVycmlkZGVuIHRvXG4gKiBoaWRlIHRoaXMgc3RhbmQtaW4gY2xhc3MgZnJvbSB1c2Vycy5cbiAqXG4gKiBJbiBvcmRlciB0byBjcmVhdGUgaW5zdGFuY2Ugb2YgdGhlIHVzZXItZGVmaW5lZCBjbGFzcywgcmF0aGVyIHRoYW4gdGhlIHN0YW5kXG4gKiBpbiwgdGhlIHN0YW5kLWluJ3MgY29uc3RydWN0b3Igc3dpenpsZXMgaXRzIGluc3RhbmNlcyBwcm90b3R5cGUgYW5kIGludm9rZXNcbiAqIHRoZSB1c2VyLWRlZmluZWQgY29uc3RydWN0b3IuIFdoZW4gdGhlIHVzZXItZGVmaW5lZCBjb25zdHJ1Y3RvciBpcyBjYWxsZWRcbiAqIGRpcmVjdGx5IGl0IGNyZWF0ZXMgYW4gaW5zdGFuY2Ugb2YgdGhlIHN0YW5kLWluIGNsYXNzIHRvIGdldCBhIHJlYWwgZXh0ZW5zaW9uXG4gKiBvZiBIVE1MRWxlbWVudCBhbmQgcmV0dXJucyB0aGF0LlxuICpcbiAqIFRoZXJlIGFyZSB0d28gaW1wb3J0YW50IGNvbnN0cnVjdG9yczogQSBwYXRjaGVkIEhUTUxFbGVtZW50IGNvbnN0cnVjdG9yLCBhbmRcbiAqIHRoZSBTdGFuZEluRWxlbWVudCBjb25zdHJ1Y3Rvci4gVGhleSBib3RoIHdpbGwgYmUgY2FsbGVkIHRvIGNyZWF0ZSBhbiBlbGVtZW50XG4gKiBidXQgd2hpY2ggaXMgY2FsbGVkIGZpcnN0IGRlcGVuZHMgb24gd2hldGhlciB0aGUgYnJvd3NlciBjcmVhdGVzIHRoZSBlbGVtZW50XG4gKiBvciB0aGUgdXNlci1kZWZpbmVkIGNvbnN0cnVjdG9yIGlzIGNhbGxlZCBkaXJlY3RseS4gVGhlIHZhcmlhYmxlc1xuICogYGJyb3dzZXJDb25zdHJ1Y3Rpb25gIGFuZCBgdXNlckNvbnN0cnVjdGlvbmAgY29udHJvbCB0aGUgZmxvdyBiZXR3ZWVuIHRoZVxuICogdHdvIGNvbnN0cnVjdG9ycy5cbiAqXG4gKiBUaGlzIHNoaW0gc2hvdWxkIGJlIGJldHRlciB0aGFuIGZvcmNpbmcgdGhlIHBvbHlmaWxsIGJlY2F1c2U6XG4gKiAgIDEuIEl0J3Mgc21hbGxlclxuICogICAyLiBBbGwgcmVhY3Rpb24gdGltaW5ncyBhcmUgdGhlIHNhbWUgYXMgbmF0aXZlIChtb3N0bHkgc3luY2hyb25vdXMpXG4gKiAgIDMuIEFsbCByZWFjdGlvbiB0cmlnZ2VyaW5nIERPTSBvcGVyYXRpb25zIGFyZSBhdXRvbWF0aWNhbGx5IHN1cHBvcnRlZFxuICpcbiAqIFRoZXJlIGFyZSBzb21lIHJlc3RyaWN0aW9ucyBhbmQgcmVxdWlyZW1lbnRzIG9uIEVTNSBjb25zdHJ1Y3RvcnM6XG4gKiAgIDEuIEFsbCBjb25zdHJ1Y3RvcnMgaW4gYSBpbmhlcml0YW5jZSBoaWVyYXJjaHkgbXVzdCBiZSBFUzUtc3R5bGUsIHNvIHRoYXRcbiAqICAgICAgdGhleSBjYW4gYmUgY2FsbGVkIHdpdGggRnVuY3Rpb24uY2FsbCgpLiBUaGlzIGVmZmVjdGl2ZWx5IG1lYW5zIHRoYXQgdGhlXG4gKiAgICAgIHdob2xlIGFwcGxpY2F0aW9uIG11c3QgYmUgY29tcGlsZWQgdG8gRVM1LlxuICogICAyLiBDb25zdHJ1Y3RvcnMgbXVzdCByZXR1cm4gdGhlIHZhbHVlIG9mIHRoZSBlbXVsYXRlZCBzdXBlcigpIGNhbGwuIExpa2VcbiAqICAgICAgYHJldHVybiBTdXBlckNsYXNzLmNhbGwodGhpcylgXG4gKiAgIDMuIFRoZSBgdGhpc2AgcmVmZXJlbmNlIHNob3VsZCBub3QgYmUgdXNlZCBiZWZvcmUgdGhlIGVtdWxhdGVkIHN1cGVyKCkgY2FsbFxuICogICAgICBqdXN0IGxpa2UgYHRoaXNgIGlzIGlsbGVnYWwgdG8gdXNlIGJlZm9yZSBzdXBlcigpIGluIEVTNi5cbiAqICAgNC4gQ29uc3RydWN0b3JzIHNob3VsZCBub3QgY3JlYXRlIG90aGVyIGN1c3RvbSBlbGVtZW50cyBiZWZvcmUgdGhlIGVtdWxhdGVkXG4gKiAgICAgIHN1cGVyKCkgY2FsbC4gVGhpcyBpcyB0aGUgc2FtZSByZXN0cmljdGlvbiBhcyB3aXRoIG5hdGl2ZSBjdXN0b21cbiAqICAgICAgZWxlbWVudHMuXG4gKlxuICogIENvbXBpbGluZyB2YWxpZCBjbGFzcy1iYXNlZCBjdXN0b20gZWxlbWVudHMgdG8gRVM1IHdpbGwgc2F0aXNmeSB0aGVzZVxuICogIHJlcXVpcmVtZW50cyB3aXRoIHRoZSBsYXRlc3QgdmVyc2lvbiBvZiBwb3B1bGFyIHRyYW5zcGlsZXJzLlxuICovXG4oKCkgPT4ge1xuICAndXNlIHN0cmljdCc7XG5cbiAgLy8gRG8gbm90aGluZyBpZiBgY3VzdG9tRWxlbWVudHNgIGRvZXMgbm90IGV4aXN0LlxuICBpZiAoIXdpbmRvdy5jdXN0b21FbGVtZW50cykgcmV0dXJuO1xuXG4gIGNvbnN0IE5hdGl2ZUhUTUxFbGVtZW50ID0gd2luZG93LkhUTUxFbGVtZW50O1xuICBjb25zdCBuYXRpdmVEZWZpbmUgPSB3aW5kb3cuY3VzdG9tRWxlbWVudHMuZGVmaW5lO1xuICBjb25zdCBuYXRpdmVHZXQgPSB3aW5kb3cuY3VzdG9tRWxlbWVudHMuZ2V0O1xuXG4gIC8qKlxuICAgKiBNYXAgb2YgdXNlci1wcm92aWRlZCBjb25zdHJ1Y3RvcnMgdG8gdGFnIG5hbWVzLlxuICAgKlxuICAgKiBAdHlwZSB7TWFwPEZ1bmN0aW9uLCBzdHJpbmc+fVxuICAgKi9cbiAgY29uc3QgdGFnbmFtZUJ5Q29uc3RydWN0b3IgPSBuZXcgTWFwKCk7XG5cbiAgLyoqXG4gICAqIE1hcCBvZiB0YWcgbmFtZXMgdG8gdXNlci1wcm92aWRlZCBjb25zdHJ1Y3RvcnMuXG4gICAqXG4gICAqIEB0eXBlIHtNYXA8c3RyaW5nLCBGdW5jdGlvbj59XG4gICAqL1xuICBjb25zdCBjb25zdHJ1Y3RvckJ5VGFnbmFtZSA9IG5ldyBNYXAoKTtcblxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBjb25zdHJ1Y3RvcnMgYXJlIGJlaW5nIGNhbGxlZCBieSBhIGJyb3dzZXIgcHJvY2VzcywgaWUgcGFyc2luZ1xuICAgKiBvciBjcmVhdGVFbGVtZW50LlxuICAgKi9cbiAgbGV0IGJyb3dzZXJDb25zdHJ1Y3Rpb24gPSBmYWxzZTtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgY29uc3RydWN0b3JzIGFyZSBiZWluZyBjYWxsZWQgYnkgYSB1c2VyLXNwYWNlIHByb2Nlc3MsIGllXG4gICAqIGNhbGxpbmcgYW4gZWxlbWVudCBjb25zdHJ1Y3Rvci5cbiAgICovXG4gIGxldCB1c2VyQ29uc3RydWN0aW9uID0gZmFsc2U7XG5cbiAgd2luZG93LkhUTUxFbGVtZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghYnJvd3NlckNvbnN0cnVjdGlvbikge1xuICAgICAgY29uc3QgdGFnbmFtZSA9IHRhZ25hbWVCeUNvbnN0cnVjdG9yLmdldCh0aGlzLmNvbnN0cnVjdG9yKTtcbiAgICAgIGNvbnN0IGZha2VDbGFzcyA9IG5hdGl2ZUdldC5jYWxsKHdpbmRvdy5jdXN0b21FbGVtZW50cywgdGFnbmFtZSk7XG5cbiAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBmYWtlIGNvbnN0cnVjdG9yIGRvZXNuJ3QgY2FsbCBiYWNrIHRvIHRoaXMgY29uc3RydWN0b3JcbiAgICAgIHVzZXJDb25zdHJ1Y3Rpb24gPSB0cnVlO1xuICAgICAgY29uc3QgaW5zdGFuY2UgPSBuZXcgKGZha2VDbGFzcykoKTtcbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9XG4gICAgLy8gRWxzZSBkbyBub3RoaW5nLiBUaGlzIHdpbGwgYmUgcmVhY2hlZCBieSBFUzUtc3R5bGUgY2xhc3NlcyBkb2luZ1xuICAgIC8vIEhUTUxFbGVtZW50LmNhbGwoKSBkdXJpbmcgaW5pdGlhbGl6YXRpb25cbiAgICBicm93c2VyQ29uc3RydWN0aW9uID0gZmFsc2U7XG4gIH07XG4gIC8vIEJ5IHNldHRpbmcgdGhlIHBhdGNoZWQgSFRNTEVsZW1lbnQncyBwcm90b3R5cGUgcHJvcGVydHkgdG8gdGhlIG5hdGl2ZVxuICAvLyBIVE1MRWxlbWVudCdzIHByb3RvdHlwZSB3ZSBtYWtlIHN1cmUgdGhhdDpcbiAgLy8gICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50XG4gIC8vIHdvcmtzIGJlY2F1c2UgaW5zdGFuY2VvZiB1c2VzIEhUTUxFbGVtZW50LnByb3RvdHlwZSwgd2hpY2ggaXMgb24gdGhlXG4gIC8vIHB0b3RvdHlwZSBjaGFpbiBvZiBidWlsdC1pbiBlbGVtZW50cy5cbiAgd2luZG93LkhUTUxFbGVtZW50LnByb3RvdHlwZSA9IE5hdGl2ZUhUTUxFbGVtZW50LnByb3RvdHlwZTtcblxuICBjb25zdCBkZWZpbmUgPSAodGFnbmFtZSwgZWxlbWVudENsYXNzKSA9PiB7XG4gICAgY29uc3QgZWxlbWVudFByb3RvID0gZWxlbWVudENsYXNzLnByb3RvdHlwZTtcbiAgICBjb25zdCBTdGFuZEluRWxlbWVudCA9IGNsYXNzIGV4dGVuZHMgTmF0aXZlSFRNTEVsZW1lbnQge1xuICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIENhbGwgdGhlIG5hdGl2ZSBIVE1MRWxlbWVudCBjb25zdHJ1Y3RvciwgdGhpcyBnaXZlcyB1cyB0aGVcbiAgICAgICAgLy8gdW5kZXItY29uc3RydWN0aW9uIGluc3RhbmNlIGFzIGB0aGlzYDpcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyBUaGUgcHJvdG90eXBlIHdpbGwgYmUgd3JvbmcgdXAgYmVjYXVzZSB0aGUgYnJvd3NlciB1c2VkIG91ciBmYWtlXG4gICAgICAgIC8vIGNsYXNzLCBzbyBmaXggaXQ6XG4gICAgICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZih0aGlzLCBlbGVtZW50UHJvdG8pO1xuXG4gICAgICAgIGlmICghdXNlckNvbnN0cnVjdGlvbikge1xuICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHVzZXItZGVmaW5lZCBjb25zdHJ1Y3RvciBib3R0b20ncyBvdXQgdG8gYSBkby1ub3RoaW5nXG4gICAgICAgICAgLy8gSFRNTEVsZW1lbnQoKSBjYWxsXG4gICAgICAgICAgYnJvd3NlckNvbnN0cnVjdGlvbiA9IHRydWU7XG4gICAgICAgICAgLy8gQ2FsbCB0aGUgdXNlci1kZWZpbmVkIGNvbnN0cnVjdG9yIG9uIG91ciBpbnN0YW5jZTpcbiAgICAgICAgICBlbGVtZW50Q2xhc3MuY2FsbCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICB1c2VyQ29uc3RydWN0aW9uID0gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBzdGFuZEluUHJvdG8gPSBTdGFuZEluRWxlbWVudC5wcm90b3R5cGU7XG4gICAgU3RhbmRJbkVsZW1lbnQub2JzZXJ2ZWRBdHRyaWJ1dGVzID0gZWxlbWVudENsYXNzLm9ic2VydmVkQXR0cmlidXRlcztcbiAgICBzdGFuZEluUHJvdG8uY29ubmVjdGVkQ2FsbGJhY2sgPSBlbGVtZW50UHJvdG8uY29ubmVjdGVkQ2FsbGJhY2s7XG4gICAgc3RhbmRJblByb3RvLmRpc2Nvbm5lY3RlZENhbGxiYWNrID0gZWxlbWVudFByb3RvLmRpc2Nvbm5lY3RlZENhbGxiYWNrO1xuICAgIHN0YW5kSW5Qcm90by5hdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2sgPSBlbGVtZW50UHJvdG8uYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrO1xuICAgIHN0YW5kSW5Qcm90by5hZG9wdGVkQ2FsbGJhY2sgPSBlbGVtZW50UHJvdG8uYWRvcHRlZENhbGxiYWNrO1xuXG4gICAgdGFnbmFtZUJ5Q29uc3RydWN0b3Iuc2V0KGVsZW1lbnRDbGFzcywgdGFnbmFtZSk7XG4gICAgY29uc3RydWN0b3JCeVRhZ25hbWUuc2V0KHRhZ25hbWUsIGVsZW1lbnRDbGFzcyk7XG4gICAgbmF0aXZlRGVmaW5lLmNhbGwod2luZG93LmN1c3RvbUVsZW1lbnRzLCB0YWduYW1lLCBTdGFuZEluRWxlbWVudCk7XG4gIH07XG5cbiAgY29uc3QgZ2V0ID0gKHRhZ25hbWUpID0+IGNvbnN0cnVjdG9yQnlUYWduYW1lLmdldCh0YWduYW1lKTtcblxuICAvLyBXb3JrYXJvdW5kIGZvciBTYWZhcmkgYnVnIHdoZXJlIHBhdGNoaW5nIGN1c3RvbUVsZW1lbnRzIGNhbiBiZSBsb3N0LCBsaWtlbHlcbiAgLy8gZHVlIHRvIG5hdGl2ZSB3cmFwcGVyIGdhcmJhZ2UgY29sbGVjdGlvbiBpc3N1ZVxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCAnY3VzdG9tRWxlbWVudHMnLFxuICAgIHsgdmFsdWU6IHdpbmRvdy5jdXN0b21FbGVtZW50cywgY29uZmlndXJhYmxlOiB0cnVlLCB3cml0YWJsZTogdHJ1ZSB9KTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdy5jdXN0b21FbGVtZW50cywgJ2RlZmluZScsXG4gICAgeyB2YWx1ZTogZGVmaW5lLCBjb25maWd1cmFibGU6IHRydWUsIHdyaXRhYmxlOiB0cnVlIH0pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LmN1c3RvbUVsZW1lbnRzLCAnZ2V0JyxcbiAgICB7IHZhbHVlOiBnZXQsIGNvbmZpZ3VyYWJsZTogdHJ1ZSwgd3JpdGFibGU6IHRydWUgfSk7XG5cbn0pKCk7IiwiXG5sZXQgcmF0ZXM7XG5mZXRjaCgnaHR0cHM6Ly9hcGkuZml4ZXIuaW8vbGF0ZXN0JylcbiAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgaWYocmVzcG9uc2Uub2spIHsgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbnZlcnNpb24gcmF0ZXMgY291bGQgbm90IGJlIHJlYWNoZWQuIFRyeSBhZ2FpbiBsYXRlcicpO1xuICAgIH0pXG4gICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgcmF0ZXMgPSBkYXRhLnJhdGVzO1xuICAgICAgICByYXRlc1tcIkVVUlwiXSA9IDE7XG4gICAgICAgIC8vIHJldHVybiByYXRlcztcbiAgICB9KTtcblxuXG5cbmNsYXNzIEN1cnJlbmN5Q29udmVydGVyIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcblxuICAgICAgICBsZXQgZWxlbWVudHNPYmplY3QgPSB7fTtcblxuICAgICAgICAvLyBDb252ZXIgYW1vdW50IGZyb20gLSBpbnB1dDpcbiAgICAgICAgdGhpcy5zaGFkb3cgPSB0aGlzLmF0dGFjaFNoYWRvdyh7IG1vZGU6ICdvcGVuJyB9KTtcbiAgICAgICAgY29uc3Qgc2hhZG93Um9vdCA9IHRoaXMuc2hhZG93O1xuXG4gICAgICAgIC8vIENTUyBzdHlsZTpcbiAgICAgICAgc2hhZG93Um9vdC5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICA8c3R5bGU+XG4gICAgICAgICAgICAgICAgaDEge1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW46IDAgNSUgMiU7XG4gICAgICAgICAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAnUmFsZXdheS1Cb2xkJywgc2Fucy1zZXJpZjtcbiAgICAgICAgICAgICAgICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgICAgICAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwIHtcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luOiAwIDUlIDIlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpbnB1dFt0eXBlPXRleHRdIHtcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDUwJTtcbiAgICAgICAgICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6IDIlIDIlO1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW46IDAgNSU7XG4gICAgICAgICAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAnUmFsZXdheS1SZWd1bGFyJywgc2Fucy1zZXJpZjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaW5wdXQ6ZGlzYWJsZWQge1xuICAgICAgICAgICAgICAgICAgICBmb250LWZhbWlseTogJ1JhbGV3YXktQm9sZCcsIHNhbnMtc2VyaWY7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yOiAjMDAwO1xuICAgICAgICAgICAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzZWxlY3Qge1xuICAgICAgICAgICAgICAgICAgICB3aWR0aDogMjAlO1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW46IDAgMiUgNSU7XG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogMzBweDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAjZGlzY2xhaW1lci1jb250YWluZXIge1xuICAgICAgICAgICAgICAgICAgICBmbG9hdDogcmlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAnUmFsZXdheS1NZWRpdW1JdGFsaWMnLCBzYW5zLXNlcmlmO1xuICAgICAgICAgICAgICAgICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgICAgICAgICAgICAgICBmb250LXN0eWxlOiBpdGFsaWM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgPC9zdHlsZT5cbiAgICAgICAgYDtcblxuICAgICAgICBmdW5jdGlvbiByZW5kZXJFbGVtZW50KHBhcmVudE5vZGUsIGVsZW1lbnROYW1lU3RyaW5nLCB0YWdTdHJpbmcsIHByb3BlcnR5T2JqZWN0KSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdTdHJpbmcpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwcm9wZXJ0eSBpbiBwcm9wZXJ0eU9iamVjdCkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnRbcHJvcGVydHldID0gcHJvcGVydHlPYmplY3RbcHJvcGVydHldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGFyZW50Tm9kZS5hcHBlbmRDaGlsZChlbGVtZW50KTtcblxuICAgICAgICAgICAgZWxlbWVudHNPYmplY3RbZWxlbWVudE5hbWVTdHJpbmddID0gZWxlbWVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlbmRlckVsZW1lbnQoc2hhZG93Um9vdCwgJ2hlYWRpbmcnLCAnaDEnLCB7XG4gICAgICAgICAgICAnaW5uZXJIVE1MJzogJ0N1cnJlbmN5IGNvbnZlcnRlcidcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmVuZGVyRWxlbWVudChzaGFkb3dSb290LCAnaW5zdHJ1Y3Rpb24nLCAncCcsIHtcbiAgICAgICAgICAgICdpbm5lckhUTUwnOiAnVHlwZSBpbiBhbW91bnQgYW5kIHNlbGVjdCBjdXJyZW5jeTonXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlbmRlckVsZW1lbnQoc2hhZG93Um9vdCwgJ2Ftb3VudEZyb21JbnB1dCcsICdpbnB1dCcsIHtcbiAgICAgICAgICAgICd0eXBlJzogJ3RleHQnXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy8gQ29udmVyIGN1cnJlbmN5IGZyb20gLSBzZWxlY3Q6XG4gICAgICAgIGNvbnN0IGN1cnJlbmN5U2VsZWN0T3B0aW9ucyA9IGBcbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJDQURcIiBzZWxlY3RlZD5DQUQ8L29wdGlvbj5cbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJVU0RcIj5VU0Q8L29wdGlvbj5cbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJFVVJcIj5FVVI8L29wdGlvbj5gO1xuXG4gICAgICAgIHJlbmRlckVsZW1lbnQoc2hhZG93Um9vdCwgJ2N1cnJlbmN5RnJvbVNlbGVjdCcsICdzZWxlY3QnLCB7XG4gICAgICAgICAgICAnaW5uZXJIVE1MJzogY3VycmVuY3lTZWxlY3RPcHRpb25zXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlbmRlckVsZW1lbnQoc2hhZG93Um9vdCwgJ3Jlc3VsdEhlYWRpbmcnLCAncCcsIHtcbiAgICAgICAgICAgICdpbm5lckhUTUwnOiAnQ29udmVydGVkIGFtb3VudDonXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy8gQ29udmVyIGFtb3VudCB0byAtIGlucHV0OlxuICAgICAgICByZW5kZXJFbGVtZW50KHNoYWRvd1Jvb3QsICdhbW91bnRUb0lucHV0JywgJ2lucHV0Jywge1xuICAgICAgICAgICAgJ3R5cGUnOiAndGV4dCcsXG4gICAgICAgICAgICAnZGlzYWJsZWQnOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIENvbnZlciBjdXJyZW5jeSB0byAtIHNlbGVjdDpcbiAgICAgICAgcmVuZGVyRWxlbWVudChzaGFkb3dSb290LCAnY3VycmVuY3lUb1NlbGVjdCcsICdzZWxlY3QnLCB7XG4gICAgICAgICAgICAnaW5uZXJIVE1MJzogY3VycmVuY3lTZWxlY3RPcHRpb25zXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIERpc2NsYWltZXI6XG4gICAgICAgIGNvbnN0IGRpc2NsYWltZXJEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZGlzY2xhaW1lckRpdi5pZCA9ICdkaXNjbGFpbWVyLWNvbnRhaW5lcic7XG5cbiAgICAgICAgcmVuZGVyRWxlbWVudChkaXNjbGFpbWVyRGl2LCAnZGlzY2xhaW1lcicsICdhJywge1xuICAgICAgICAgICAgJ2hyZWYnOiAnaHR0cHM6Ly93d3cuZWNiLmV1cm9wYS5ldS9zdGF0cy9wb2xpY3lfYW5kX2V4Y2hhbmdlX3JhdGVzL2V1cm9fcmVmZXJlbmNlX2V4Y2hhbmdlX3JhdGVzL2h0bWwvaW5kZXguZW4uaHRtbCcsXG4gICAgICAgICAgICAndGFyZ2V0JzogJ19ibGFuaycsXG4gICAgICAgICAgICAnaW5uZXJIVE1MJzogJ0Rpc2NsYWltZXInLFxuICAgICAgICAgICAgJ2lkJzogJ2Rpc2NsYWltZXInXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQoZGlzY2xhaW1lckRpdik7XG5cbiAgICAgICAgZWxlbWVudHNPYmplY3QuYW1vdW50RnJvbUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgY2hhbmdlQ2FsbGJhY2sgKTtcbiAgICAgICAgZWxlbWVudHNPYmplY3QuY3VycmVuY3lGcm9tU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGNoYW5nZUNhbGxiYWNrICk7XG4gICAgICAgIGVsZW1lbnRzT2JqZWN0LmN1cnJlbmN5VG9TZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgY2hhbmdlQ2FsbGJhY2spO1xuXG4gICAgICAgIGZ1bmN0aW9uIGNoYW5nZUNhbGxiYWNrKCkge1xuICAgICAgICAgICAgY29uc3QgYWxwaGFiZXRSZW1vdmVkID0gZWxlbWVudHNPYmplY3QuYW1vdW50RnJvbUlucHV0LnZhbHVlLnJlcGxhY2UoL1teXFxkKy5dL2csIFwiXCIpO1xuICAgICAgICAgICAgZWxlbWVudHNPYmplY3QuYW1vdW50RnJvbUlucHV0LnZhbHVlID0gYWxwaGFiZXRSZW1vdmVkLm1hdGNoKC9cXGQqXFwuP1xcZHswLDJ9Lyk7XG4gICAgICAgICAgICBjb25zdCBhbW91bnRUbyA9IGdldENvbnZlcnRlZEFtb3VudCgpO1xuICAgICAgICAgICAgZWxlbWVudHNPYmplY3QuYW1vdW50VG9JbnB1dC52YWx1ZSA9IE1hdGgucm91bmQoYW1vdW50VG8gKiAxMDApIC8gMTAwO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldENvbnZlcnRlZEFtb3VudCgpIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50c09iamVjdC5hbW91bnRGcm9tSW5wdXQudmFsdWUgKiByYXRlc1tlbGVtZW50c09iamVjdC5jdXJyZW5jeVRvU2VsZWN0LnZhbHVlXSAvIHJhdGVzW2VsZW1lbnRzT2JqZWN0LmN1cnJlbmN5RnJvbVNlbGVjdC52YWx1ZV07XG4gICAgICAgIH1cbiAgICB9XG5cbn1cblxud2luZG93LmN1c3RvbUVsZW1lbnRzLmRlZmluZSgnY3VycmVuY3ktY29udmVydGVyJywgQ3VycmVuY3lDb252ZXJ0ZXIpOyJdfQ==
