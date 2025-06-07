const express = require('express');
const router = express.Router();
const Schema = require('../model/default');
const config = require('../router/config');
const Structure = require('../model/structure');
/* GET home page. */
router.post('', async (req, res, next) => {
    try{

        // console.log('검색어 : ' + req.body.text);

        let searchText = req.body.text;
        let search_list = config.search.in.map((v)=>{let obj={}; obj[v] = {$regex:searchText, $options: "i"}; return obj;});
        
        // console.log('Search List : ' + JSON.stringify(search_list, null, 2));



        let result = await Schema.aggregate([
            {$match:{$or:search_list}},
            {$match:{'@type':{$nin:config.search.nin}}}
        ]);

        // console.log('Result : ' + JSON.stringify(result, null, 2));

        // 데이터 정렬
        result.sort((a, b) => {
            if(a._id < b._id) return -1;
            if(a._id > b._id) return 1;
        });



        // console.log('skosConcept --- : ' + JSON.stringify(skosConcept, null, '\t'));



        res.send(result);
    }catch(e){
        res.status(404);
    }
});
module.exports = router;
