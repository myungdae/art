(() => {
  function setEnglishMessages(el){
    const clear = () => el.setCustomValidity('');
    el.addEventListener('invalid', () => {
      el.setCustomValidity('');
      if (el.validity.valueMissing) {
        el.setCustomValidity('This field is required.');
      } else if (el.validity.typeMismatch && el.type === 'email') {
        el.setCustomValidity('Please enter a valid email address.');
      } else if (el.validity.typeMismatch && el.type === 'url') {
        el.setCustomValidity('Please enter a valid URL.');
      } else if (el.validity.patternMismatch) {
        el.setCustomValidity('Please match the requested format.');
      } else if (el.validity.tooShort) {
        el.setCustomValidity(`Please lengthen this text to at least ${el.minLength} characters.`);
      } else if (el.validity.rangeUnderflow) {
        el.setCustomValidity(`Value must be at least ${el.min}.`);
      } else if (el.validity.rangeOverflow) {
        el.setCustomValidity(`Value must be at most ${el.max}.`);
      } else if (el.tagName === 'SELECT' && el.required) {
        el.setCustomValidity('Please select an option from the list.');
      }
    });
    el.addEventListener('input', clear);
    el.addEventListener('change', clear);
  }

  function wireUpForm(form){
    form.setAttribute('lang','en'); // 폼 자체도 영어로 고정
    form.querySelectorAll('input, select, textarea').forEach(setEnglishMessages);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form').forEach(wireUpForm);
  });
})();
