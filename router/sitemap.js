const express = require("express");
const router = express.Router();
const Schema = require("../model/default");
const config = require("../router/config");
const Structure = require("../model/structure");
const SearchSchema = require("../model/search");

const JobVacancy = require("../model/jobVacancy");
const OnlineTutor = require("../model/onlineTutor");
const JobSeeker = require("../model/jobSeeker");

/*
키워드 검색 결과 화면
*/
/* GET home page. */
router.post("", async (req, res, next) => {
  try {
    let searchText = req.body.searchText;
    // search 스키마에 검색어 저장
    await SearchSchema.create({ searchText: searchText });

    // console.log('----------------------------------------------');
    // console.log('searchText : ' + searchText);
    // console.log('----------------------------------------------');

    const regex = new RegExp(searchText, "i");

    const [vacancies, tutors, seekers] = await Promise.all([
      JobVacancy.find({
        $or: [{ title: regex }, { description: regex }],
      }).sort({ datePosted: -1 }),

      OnlineTutor.find({
        $or: [{ title: regex }, { description: regex }],
      }).sort({ datePosted: -1 }),

      JobSeeker.find({
        $or: [{ title: regex }, { description: regex }],
      }).sort({ datePosted: -1 }),
    ]);

    const result = [
      { _id: "Job_Vacancies", count: vacancies.length, list: vacancies },
      { _id: "Online_Tutors", count: tutors.length, list: tutors },
      { _id: "Job_Seekers", count: seekers.length, list: seekers },
    ];

    res.render("sitemap", {
      result: result,
      searchText: searchText,
    });
    return a;
    // 검색어로 검색한 결과
    // let search_list = config.search.in.map((v) => {
    //   let obj = {};
    //   obj[v] = { $regex: searchText };
    //   return obj;
    // });

    // let result = await Schema.aggregate([
    //   { $match: { "@type": { $exists: true } } },
    //   { $match: { $or: search_list } },
    //   { $match: { "@type": { $nin: config.search.nin } } },
    //   {
    //     $group: {
    //       _id: "$@type",
    //       count: { $sum: 1 },
    //       list: { $push: "$$ROOT" },
    //     },
    //   },
    // ]);

    // // 데이터 정렬
    // result.sort((a, b) => {
    //   if (a._id < b._id) return -1;
    //   if (a._id > b._id) return 1;
    // });

    // console.log("result", result);

    // res.render("sitemap", {
    //   result: result,
    //   searchText: searchText,
    // });
  } catch (e) {
    res.status(404);
  }
});

module.exports = router;
