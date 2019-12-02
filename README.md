# notext.news

> Language is displaced in the cloak of erasure, leaving behind only structure and image.
— Kenneth Goldsmith

On the web, we are inundated with words. Every post online has an agenda, whether that's to amuse, attack, emote, or in the case of the news, inform. But the web is also a platform of sights and sounds. What happens when a primary form of human communication is removed? What can we still see with one eye closed?

This is a reinterpretation of Sarah Charlesworth's piece [April 21, 1978](https://www.metmuseum.org/art/collection/search/299337).

It works by:

* Launching a browser in the background and navigating to a news page
* Removing all the text from that page
* Sending the stripped HTML contents of the page back to the original site

This is done mostly to avoid CORS issues with trying to manipulate the original content directly, and partly for the reason that most news sites are not static and dynamically load the events of the day. This has an unfortunate performance hit that can't be avoided. To work around this, a cron job runs once every five minutes to perform this process and essentially cache the rendered pages.

Please note: I am not advocating that you ever ignore the news. That's a viewpoint situated in a position of extreme privilege. This is just an art project.
