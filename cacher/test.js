import axios from "axios";
import * as cheerio from "cheerio";

async function generate(url) {
	// TODO: Generate curated markdown instead of copy-pasting the HTML
	const html = (await axios.get(url)).data;
	const data = {
		url,
		title: "",
		blurb: "",
		sections: [],
	};
	const $ = cheerio.load(html);
	const articleBody = $(".rst-content").children(".document").children().children("section");
	data.title = articleBody.children("h1").first().text().slice(0, -1);
	articleBody.children("p").each((i, el) => {
		data.blurb += `<p>${$(el).html()}</p>`;
	});
	articleBody.children("section").each((i, el) => {
		data.sections.push({
			header: $(el).find("h2").text().slice(0, -1),
			content: $(el).html().split("\n").slice(2).join(""),
		});
	});

	return data;
}

console.log(await generate("https://docs.godotengine.org/en/4.1/classes/class_aabb.html"));