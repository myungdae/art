// fix_titles.js
// ✅ Online_Tutors / Online_Tutors_RDF 의 _label/title 정리

function fixCollection(collName) {
  print(`\n🔧 Fixing collection: ${collName}`);

  // 1) _label 채우기: _label이 없거나 비었으면 title → name → jobTitle → email → Untitled
  db.getCollection(collName).updateMany(
    {},
    [
      {
        $set: {
          _label: {
            $cond: [
              { $gt: [ { $strLenCP: { $ifNull: ["$_label",""] } }, 0 ] }, "$_label",
              { $ifNull: ["$title",
                { $ifNull: ["$name",
                  { $ifNull: ["$jobTitle", { $ifNull: ["$email","Untitled"] } ] }
                ]}
              ]}
            ]
          }
        }
      }
    ]
  );

  // 2) title 비었으면 _label 값으로 보정
  db.getCollection(collName).updateMany(
    { $or: [ { title: { $exists: false } }, { title: "" } ] },
    [ { $set: { title: "$_label" } } ]
  );

  // 3) 결과 확인
  const sample = db.getCollection(collName)
    .find({}, { _id: 1, title: 1, _label: 1 })
    .limit(5)
    .toArray();

  print(`✅ ${collName} updated. Sample docs:`);
  printjson(sample);
}

// 실행
fixCollection("Online_Tutors");
fixCollection("Online_Tutors_RDF");

print("\n🎉 All fixes applied successfully!");
