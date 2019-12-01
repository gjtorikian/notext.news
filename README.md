# notext.news

> Language is displaced in the cloak of erasure, leaving behind only structure and image.
—Kenneth Goldsmith

This is a reinterpretation of Sarah Charlesworth's piece [April 21, 1978](https://www.metmuseum.org/art/collection/search/299337).

It works by:

* Launching a browser in the background and navigating to a news page
* Removing all the text from that page
* Sending the stripped HTML contents of the page back to the original site

This is done mostly to avoid CORS issues with trying to manipulate the original content directly, and partly for the reason that most news sites are not static and dynamically load the events of the day. This has an unfortunate performance hit that can't be avoided.
