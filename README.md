# MightyCrawler

Web crawler that finds text on webpages.
Initial service was built to crawl www.MightyApe.co.nz for images on their product pages related to an easter egg hunt.

The service does not do any form of DOM/jQuery work, it just downloads the page and searches through it's contents.

## Configuration:
####config.json:
* `logger`
	* `level` - Logging level to display in console (`debug`, `verbose`, `info`, `warn`, `error`, `Match`)
	* `toFile` - `true` to log general data to file (default `false`)
	* `colorize` - `true` to show colors for log levels in console (default `false`)
* `master`
	* `workers` - Number of worker processes to spin up (default `1`)

## Rules:
Rules contain the site(s) you are scraping, the filters determining where the crawler goes and the matches to look for on pages.
To add a new rule simply add a .json file into the `rules` folder.
####example:
Will start at `http://www.mightyape.co.nz/` and follow every link on the `www.mightyape.co.nz` domain that is either `/product/`, `/Games/`, `/Books/`, `/DVDs-Blu-ray/`, `/Toys/`, `/Clothing/`, `/Home-Living/`, `/Fitness-Nutrition/`, or `/Baby/`. If it finds the text `id="product-hunt-image"` on any of the pages, it will save the url as a match.
```javascript
{
	"root": "http://www.mightyape.co.nz/",
	"matchesExpected": 8,
	"filter": [
		"(http://)?www.mightyape.co.nz/",
		[
			"http://www.mightyape.co.nz/product/",
			"http://www.mightyape.co.nz/Games/",
			"http://www.mightyape.co.nz/Books/",
			"http://www.mightyape.co.nz/DVDs-Blu-ray/",
			"http://www.mightyape.co.nz/Toys",
			"http://www.mightyape.co.nz/Clothing/",
			"http://www.mightyape.co.nz/Home-Living/",
			"http://www.mightyape.co.nz/Fitness-Nutrition/",
			"http://www.mightyape.co.nz/Baby/"
		]
	],
	"match": [
		"id=\"product-hunt-image\""
	]
}
```

* `"root": "http://www.mightyape.co.nz/"` - Required, is the first page checked
* `"matchesExpected": 8` - Optional, integer, the service will stop crawling when it has this many matches
* `"filter": [...]` - Optional, array of rules for reducing the URLs found on a page. All filters must match. Array element can either be a `string` (or `regex` in a string) in which case a direct match is required. Or element can be an array of `strings` (or arrays) that are treated as an 'or'. Mix and match for desired filtering.
* `"match": [...]` - Optional, array of rules for determining if a page is a match. Each element must be a `string` (or `regex` in a string).

## Notes:
* Does not follow redirects.

## Known Bugs:
* Occasionally not all workers return to an idle state and the service hangs after finding all matches.