let searchBox = $("#searchText");

// console.log('searchText : ' + searchBox);

if(searchBox.length){
    searchBox.autocomplete({
        source: function( request, response ) {
            $.post("/search",{"text": request.term}, function(data){
                // console.log(data);
                let result = data.map(function(item){
                    let type = (typeof(item['@type'])==='string')?item['@type'].replace(_resource, '').replace(/\[dot\]/g, '.'):item['@type'][0].replace(_resource, '').replace(/\[dot\]/g, '.');
                    let value = (item.hasOwnProperty(_label))?((item[_label].hasOwnProperty('@value'))?item[_label]['@value'].replace(_resource, '').replace(/\[dot\]/g, '.'):item[_label][0].replace(_resource, '').replace(/\[dot\]/g, '.')):item['@id'].replace(_resource, '');

                    // 로컬로 검색되도록 URL 변경
                    let _id = '/resource/' + item['@id'].replace(_resource, '');
                    // type.replace(_resource, '');
                    

                    // console.log('-------------------------------------------------------');
                    // console.log('_resource : ' + _resource);
                    // console.log('location.pathname : ' + location.pathname);
                    // console.log('type : ' + type);
                    // console.log('value : ' + value);
                    // console.log('@id : ' + item['@id']);
                    // console.log('-------------------------------------------------------');

                
                    // return {'@id':item['@id'].replace(/\[dot\]/g, '.'), 'label':value + ' (' + type + ')', 'value':value}
                    return {'@id':_id,
                        '@type':type,
                        'label':value + ' (' + type + ')',
                        'value':value
                    }
                });
                // console.log('result : ', result);
                response(result);
            });
        },
        select: function(ev,data){
            if(ev.keyCode === 13){
                let params = {};
                params["searchText"] = data.item['value'];
                postFormToUri(params,"/sitemap");
            }else{
                document.location = data.item['@id'];
            }
        }
    });
    searchBox.keypress(function(event) {

        if (event.keyCode === 13) {
            let params = {};
            params["searchText"] = this.value;



            // console.log('params : ' + params);



            postFormToUri(params,"/sitemap");
        }else{

        }
    });
}

/*
엔터로 키워드 검색
*/
function postFormToUri(params,uri) {

    // console.log('params : ' + JSON.stringify(params, null, 2));
    // console.log('uri : ' + uri);

    let form = document.createElement("form");
    form.setAttribute("method", "post");
    form.setAttribute("action", uri);
    for(let key in params) {
        if(params.hasOwnProperty(key)) {
            let hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", typeof params[key] == 'object' ? JSON.stringify(params[key]) : params[key]);
            form.appendChild(hiddenField);
        }
    }

    document.body.appendChild(form);
    form.submit();
}