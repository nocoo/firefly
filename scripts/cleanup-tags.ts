import { getDb } from "../src/lib/db";

const db = getDb();

// 1. 删除 post_count = 1 的标签
const singlePostTags = await db.query<{ id: string }>(
  "SELECT id FROM tags WHERE post_count = 1"
);
console.log(`删除 ${singlePostTags.results.length} 个只有1篇文章的标签...`);

for (const tag of singlePostTags.results) {
  await db.execute("DELETE FROM post_tags WHERE tag_id = ?", [tag.id]);
  await db.execute("DELETE FROM tags WHERE id = ?", [tag.id]);
}

// 2. 翻译 + 修复 slug（保留但改名）
const translations = [
  { oldName: "心情", newName: "Mood", newSlug: "mood" },
  { oldName: "计算机", newName: "Computer", newSlug: "computer" },
  { oldName: "微软", newName: "Microsoft", newSlug: "microsoft" },
  { oldName: "同济网", newName: "Tongji Network", newSlug: "tongji-network" },
  { oldName: "实习", newName: "Internship", newSlug: "internship" },
  { oldName: "面试", newName: "Interview", newSlug: "interview" },
];

console.log("\n翻译并修复 slug...");
for (const { oldName, newName, newSlug } of translations) {
  await db.execute(
    "UPDATE tags SET name = ?, slug = ? WHERE name = ?",
    [newName, newSlug, oldName]
  );
  console.log(`  ${oldName} → ${newName} (${newSlug})`);
}

// 3. 刷新 post_count
await db.execute(`
  UPDATE tags SET post_count = (
    SELECT COUNT(*) FROM post_tags pt
    INNER JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
    WHERE pt.tag_id = tags.id
  )
`);

console.log("\n完成！刷新后的标签：\n");
const result = await db.query<{
  name: string;
  slug: string;
  post_count: number;
}>("SELECT name, slug, post_count FROM tags ORDER BY post_count DESC");
for (const tag of result.results) {
  console.log(`  ${tag.name.padEnd(25)} | ${tag.slug.padEnd(20)} | ${tag.post_count} posts`);
}
