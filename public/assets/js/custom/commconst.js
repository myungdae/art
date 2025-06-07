const _label = 'http://www[dot]w3[dot]org/2000/01/rdf-schema#label';
const _resource = 'http://sight[dot]eventpool[dot]kr/resource/';
const _description = 'http://purl[dot]org/dc/elements/1[dot]1/description';
const _prefLabel = 'http://www[dot]w3[dot]org/2004/02/skos/core#prefLabel';
const _altLabel = 'http://www[dot]w3[dot]org/2004/02/skos/core#altLabel';
const _class = 'http://www[dot]w3[dot]org/2002/07/owl#Class';
const _datatypeProperty = 'http://www[dot]w3[dot]org/2002/07/owl#DatatypeProperty';
const _latlong = 'http://www[dot]w3[dot]org/2003/01/geo/wgs84_pos#lat_long';
const _pathname = decodeURI(location.pathname.split('/')[2]);
const _sub_path = location.pathname.split('/').length === 5?decodeURI(location.pathname.split('/')[4]):
  location.pathname.split('/').length === 4?decodeURI(location.pathname.split('/')[3]):false;



  // silkroads.eventpool.kr 서비스 
const _default_title = '맛집';
const _top_menu = ['맛집', '숙박', '여핼인프라', '테마여행', '유무형문화재', '관광명소', '자연물', '시군구'];

/*
상단 네비게이션 메뉴 선택처리 (연관파일)

/public/assets/js/custom/commconst.js
/views/layout.pug
/public/assets/css/custom.css
*/
$(function() {

  // 현재 URL 정보 추출
  var _facet_id = decodeURI(location.pathname.split('/')[location.pathname.split('/').length -1]);

  //첫 화면 인경우 설정
  if(_facet_id.length == 0) {
    var _facet_id = "맛집";
  }
  
  //네비게이션 도큐먼트 검색
  const nav_item_list = document.querySelectorAll('.nav-link');
  const nav_item_list_length = nav_item_list.length;
  
  //텍스트와 일치하는 메뉴 선택CSS 적용
  for(let i = 0; i < nav_item_list_length; i++)  {
    
    if(nav_item_list[i].innerText == _facet_id) {
      $(nav_item_list[i]).attr('style', 'color: #013ADF !important');
      // console.log('nav_item_list : ' + JSON.stringify(nav_item_list[i].style, null, 2));
    }
  }
});



