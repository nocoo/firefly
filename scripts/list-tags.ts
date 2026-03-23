import { getDb } from "../src/lib/db";

const db = getDb();
const result = await db.query<{
  id: string;
  name: string;
  slug: string;
  post_count: number;
}>("SELECT id, name, slug, post_count FROM tags ORDER BY post_count DESC, name");

console.log("当前标签：\n");
for (const tag of result.results) {
  console.log(`  ${tag.name.padEnd(20)} | slug: ${tag.slug.padEnd(20)} | posts: ${tag.post_count}`);
}
