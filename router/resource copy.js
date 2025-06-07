const express = require('express');
const router = express.Router();
const Schema = require('../model/default');
const Structure = require('../model/structure');
const config = require('../router/config');
/* GET home page. */

/*
OrderedCollection : 전체 구조 정보 (displayOnMiddle, displayOnBottom 등 포함)
displayOnMiddle : 연관 정보 (ex. 지역, 지역_이벤트 ...)
displayOnBottom : 요소 정보 (ex. 교육기관, 초청여부, 유료_무료 등 세부내용)
doc : 해당 선택 요소의 개별 정보 (ex. @id : ...서울특별시, @type : ...지역, ...지역_장소 : ...예술의전당_콘서트홀, ...대학로예술극장 ...)
*/
router.get('/:id', async(req, res, next)=>{


    // console.log('resource : ' + config.comm.resource + req.params.id);


    let doc = await Schema.findOne({'@id':config.comm.resource + req.params.id});
    let collections = await Schema.findOne({'@id':config.comm.resource + 'OrderedCollection'});
    let displayOnMiddle = collections.toObject()[config.comm.resource + 'displayOnMiddle']['@list'].map((v)=>{let obj = {}; obj[v['@id'] + '.@id'] = config.comm.resource + req.params.id; return obj});
    let table_collections= await Schema.aggregate([
        {$match:{$or:displayOnMiddle}},{ $sort : {'@id' : 1 }}
    ]);
    let skos_Concept = await Schema.find({'@type' : config.comm.skosConecept}).lean();
    let skos_Namefilter = await Schema.find({'@type' : config.comm.skosNameIdentifier}).lean();
    // let skos_Concept = await Schema.find({'@type' : config.comm.skosConecept});

    // label data 기준 정보
    // let displayOnTop = collections.toObject()[config.comm.resource + 'displayOnTop']['@list'].map((v)=>{let obj = {}; obj[v['@id'] + '.@id'] = config.comm.resource + req.params.id; return obj});
    
    // Thesauri 정보
    let displayOnTop = collections.toObject()[config.comm.resource + 'displayOnTop']['@list'].map(function(v){return v['@id']});

    // console.log("collections : " + JSON.stringify(collections, null, 2));
    // console.log("table_collections : " + JSON.stringify(table_collections, null, 2));
    // console.log("displayOnMiddle : " + JSON.stringify(displayOnMiddle, null, 2));
    // console.log("displayOnTop : " + JSON.stringify(displayOnTop, null, 2));
    

    /*
    라벨 (URI to Label) 값 처리
    */
    let displayOnMiddleInfo = await Schema.aggregate([
        {$match: {$or:collections.toObject()[config.comm.resource + 'displayOnMiddle']['@list']}},{ $sort : {'@id':1} }
    ]);
    const displayOnLabel = {};
    Object.keys(displayOnMiddleInfo).forEach(key=> {
        if(typeof displayOnMiddleInfo[key] === "object") {
            const labelUri = displayOnMiddleInfo[key]["@id"].replace(config.comm.resource, '');
            const labelWord = displayOnMiddleInfo[key]['http://www[dot]w3[dot]org/2000/01/rdf-schema#label'];
            if(labelWord) {
                displayOnLabel[labelUri] = labelWord["@value"];
            } else {
                displayOnLabel[labelUri] = labelUri;
            }
        }
    });
    // console.log("displayOnLabel : " + JSON.stringify(displayOnLabel, null, 2));
    /*
    영상 클립 (topic_clip 정보 리턴, Interrelated Information 에 반영 23.04.15)
    */
   
    const movieClipObj  = doc.toObject();
    const movieClipKeys = Object.keys(movieClipObj);
    const movieClipList = movieClipKeys.filter(key => key.endsWith("_유무형문화재") || key.endsWith("_테마여행") || key.endsWith("_관광명소") || key.endsWith("_유물유적"));
    const movieClipResult = movieClipList.map(key => movieClipObj[key]);
    const mergeArr = movieClipResult.reduce((acc, cur) => acc.concat(cur), []);
    const displayOnMovieClip = {};

    if(Array.isArray(mergeArr) && mergeArr.length > 0) {
        var mcResult = await Schema.aggregate([
            {$match:{$or:mergeArr}},{ $sort : {'@id' : 1 }}
        ]);
        Object.keys(mcResult).forEach(key=> {
                
            const resID = mcResult[key]["@id"];

            if (mcResult[key][config.comm.topic_clip]) {
                const resTopic_Clip = mcResult[key][config.comm.topic_clip]["@value"];
                displayOnMovieClip[resID] = resTopic_Clip;
            }
        });
    }

    // console.log("displayOnMovieClip : " + JSON.stringify(displayOnMovieClip, null, 2));


    // // 무비클립이 있는 정보의 topic_clip 정보 리턴 23.04.15
    // let res_se_topic_clip = doc.toObject()['http://silkroads[dot]eventpool[dot]kr/resource/Seminar_Topic'];

    // // console.log('res_se_topic_clip : ' + JSON.stringify(res_se_topic_clip, null, 2));

    // if(res_se_topic_clip){
    //     if(!Array.isArray(res_se_topic_clip)) {
    //         res_se_topic_clip = [res_se_topic_clip];
    //     }
    //     var topic_clip_se = await Schema.aggregate([
    //         {$match:{$or:res_se_topic_clip}},{ $sort : {'@id' : 1 }}
    //     ]);
    // } else {
    //     var topic_clip_se = "";
    // }

    // // 무비클립이 있는 정보의 topic_clip 정보 리턴 23.04.15
    // let res_key_topic_clip = doc.toObject()['http://silkroads[dot]eventpool[dot]kr/resource/Keyword_Topic'];

    // // console.log('res_key_topic_clip : ' + JSON.stringify(res_key_topic_clip, null, 2));

    // if(res_key_topic_clip){
    //     if(!Array.isArray(res_key_topic_clip)) {
    //         res_key_topic_clip = [res_key_topic_clip];
    //     }
    //     var topic_clip_key = await Schema.aggregate([
    //         {$match:{$or:res_key_topic_clip}},{ $sort : {'@id' : 1 }}
    //     ]);
    // } else {
    //     var topic_clip_key = "";
    // }

    // // 무비클립이 있는 정보의 topic_clip 정보 리턴 23.04.15
    // let res_keydis_topic_clip = doc.toObject()['http://silkroads[dot]eventpool[dot]kr/resource/Seminar_Discussion'];

    // // console.log('res_keydis_topic_clip : ' + JSON.stringify(res_keydis_topic_clip, null, 2));

    // if(res_keydis_topic_clip){
    //     if(!Array.isArray(res_keydis_topic_clip)) {
    //         res_keydis_topic_clip = [res_keydis_topic_clip];
    //     }
    //     var res_keyditoipc_clip_keydiss_topic_clip = await Schema.aggregate([
    //         {$match:{$or:res_keydis_topic_clip}},{ $sort : {'@id' : 1 }}
    //     ]);
    // } else {
    //     var toipc_clip_keydis = "";
    // }

    // // 무비클립이 있는 정보의 topic_clip 정보 리턴 23.04.15
    // let res_semidis_topic_clip = doc.toObject()['http://silkroads[dot]eventpool[dot]kr/resource/Seminar_Discussion'];
    // if(res_semidis_topic_clip){
    //     if(!Array.isArray(res_semidis_topic_clip)) {
    //         res_semidis_topic_clip = [res_semidis_topic_clip];
    //     }
    //     var topic_clip_semidis = await Schema.aggregate([
    //         {$match:{$or:res_semidis_topic_clip}},{ $sort : {'@id' : 1 }}
    //     ]);
    // } else {
    //     var topic_clip_semidis = "";
    // }





    







    let Labeldata = [];
    displayOnTop.forEach((item)=>{

        const labelName = item.split('/').pop();
        
        // console.log("labelName : " + JSON.stringify(labelName, null, 2));

        if(doc.toObject()[item]){
            if(Array.isArray(doc.toObject()[item])){
                doc.toObject()[item].forEach((v)=>{
                    if(v['@value']){
                        Labeldata.push(labelName + "  :  "  + v['@value']);
                    }
                });
            } else {
                if(doc.toObject()[item]['@value']){
                    Labeldata.push(labelName + "  :  "  + doc.toObject()[item]['@value']);
                }
            }
        }
    });

    // console.log("Labeldata : " + JSON.stringify(Labeldata, null, 2));
    














    // console.log('topic_clip_key : ' + JSON.stringify(topic_clip_key, null, 2));
    
    
    // var topic_clip_se = "";
    // var topic_clip_key = "";

    // console.log('req : ' + config.comm.resource + req.params.id);
    // console.log('displayOnMiddle : ' + JSON.stringify(displayOnMiddle, null, '\t'));
    // console.log('table_collections : ' + JSON.stringify(table_collections, null, '\t'));

    let searchKeyword = req.params.id;

    // console.log('searchKeyword : ' + searchKeyword);
    // console.log('-----------------------------------------------------');
    // console.log('req.params.id : ' + req.params.id);
    // console.log('doc : ' + JSON.stringify(doc, null, '\t'));
    // console.log('table_collections : ' + JSON.stringify(table_collections, null, '\t'));
    // console.log('-----------------------------------------------------');

    /*  parentClass 구하기 */
    let parentClass;

    // console.log('doc : ' + JSON.stringify(doc, null, 2));

    

    let check_subClass = 
        await Schema.aggregate([
            {$match:{$and:[{'@id':doc.toObject()['@type']}, {'http://topbraid[dot]org/facet#defaultFacets':{$exists:true}}]}}
        ]);

    /*  subClass 가 있을 경우 */
    if(!check_subClass[0]){
        let parent = await Schema.aggregate([
            {$match:{'@id':doc.toObject()['@type']}}
        ]);

        // - console.log('parent[0] : ' + parent[0]);

        // if(parent[0]) {
        //     parentClass = parent[0][config.comm.subClassOf]['@id'];
        // }
    } else {
        parentClass = check_subClass[0]['@id'];
    }
    
    // // 데이터 정렬
    // var sortField = '@id';

    // table_collections.sort((a, b) => {
    //     if(a.sortField < b.sortField) return -1;
    //     if(a.sortField > b.sortField) return 1;
    // });


    // console.log('-----------------------------------------------------');
    // console.log('doc : ' + JSON.stringify(doc, null, '\t'));
    // console.log('collections : ' + JSON.stringify(collections, null, '\t'));
    // console.log('table_collections : ' + JSON.stringify(table_collections, null, '\t'));
    // console.log('-----------------------------------------------------');


    // console.log('skos_Concept ???????? : ' + JSON.stringify(skos_Concept, null, '\t'));
    // console.log('doc : ' + JSON.stringify(doc, null, 5));

    res.render('detail', {
        doc:doc.toObject(),
        collections:collections.toObject(),
        skos_Concept:skos_Concept,
        skos_Namefilter:skos_Namefilter,
        table_collections:table_collections,
        parentClass:parentClass,
        searchKeyword:searchKeyword,
        // topic_clip_se:topic_clip_se,
        // topic_clip_key:topic_clip_key,
        // topic_clip_semidis:topic_clip_semidis,
        displayOnMovieClip,
        Labeldata:Labeldata,
        displayOnLabel:displayOnLabel,
        displayOnMovieClip:displayOnMovieClip
        
    });
});
module.exports = router;
