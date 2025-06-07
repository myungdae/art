/*  left facet click event
*   1. 클릭한 것의 facet title 과 해당 엘리먼트를 가져온다. */
function fnFilterLeft(facet, attr, title) {

  let current_filter = [];
  document.querySelectorAll('#filter_wrap b').forEach((v) => {
    current_filter.push(v.innerText + '::' + v.dataset.title + '::' + v.dataset.attr);
  });
  let form = document.createElement('form');
  form.action = location.href;
  form.method = 'POST';
  let input = document.createElement('input');
  input.name = 'item';
  let item = facet.concat('::', title).concat('::', attr);
  if (current_filter.indexOf(item) === -1) {
    current_filter.push(item);
    input.value = current_filter.join(',');
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }
}

/*  filter 의 아이템 삭제 버튼 클릭 아벤트 */
function fnRemoveFilter(item) {
  let current_filter = [];
  document.querySelectorAll('#filter_wrap b').forEach((v) => {
    current_filter.push(
      v.innerText.replace(/ /g, '_') + '::' +
      v.dataset.title + '::' +
      v.dataset.attr.replace(/ /g, '_'));
  });
  let index = current_filter.indexOf(item);
  if (index > -1) current_filter.splice(index, 1);
  let form = document.createElement('form');
  form.action = location.href;
  if (current_filter.length > 0) {
    form.method = 'POST';
    let input = document.createElement('input');
    input.name = 'item';
    input.value = current_filter.join(',');
    form.appendChild(input);
  } else {
    form.method = 'GET';
    const urlParams = new URLSearchParams(location.search)
    for(const entry of urlParams.entries()) {
        let input = document.createElement('input');
        input.name = entry[0];
        input.value = entry[1];
        form.appendChild(input);
    }
  }
  document.body.appendChild(form);
  form.submit();
}