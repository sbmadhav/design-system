#!/usr/bin/env python3
"""Put the shared site header (header.html) into a page at build time. Standard library only.

    python3 compose.py PARTIAL PAGE [PAGE ...]          rewrite each page in place
    python3 compose.py --check PARTIAL PAGE [PAGE ...]  exit 1 if a page's header differs from PARTIAL

PARTIAL is a pinned copy of header.html, for example fetched from
https://sbmadhav.com/design-system/v/2.1.0/header.html (or vendored in the consuming repo).

A page marks where its header goes and what it puts in the header's slots:

    <!-- md-header -->
    ...anything: replaced by PARTIAL...
      <!-- slot:nav --><nav class="md-nav" aria-label="Sections">...</nav><!-- /slot:nav -->
    <!-- /md-header -->

Slots are the parts a page owns: brand (the name next to the logo, default "Madhav"), nav (the page's
links or app tabs), music (the Music pill, music.html) and end (anything after it, such as a kid mode
switch). The output keeps the markers and the page's slot content, so running it again gives the same
file: the committed page always holds a complete, working header (no JavaScript needed to show it), and
updating to a new design-system version is "fetch the new header.html, run compose.py, review the diff".
"""
import pathlib, re, sys

BLOCK = re.compile(r"<!-- md-header -->\n?(.*?)<!-- /md-header -->", re.S)
SLOT = re.compile(r"<!-- slot:([\w-]+) -->(.*?)<!-- /slot:\1 -->", re.S)


def slots(src):
    return {m.group(1): m.group(2) for m in SLOT.finditer(src)}


def render(partial, page_slots):
    """The partial with every slot filled from page_slots (or the partial's default content)."""
    known = slots(partial)
    unknown = set(page_slots) - set(known)
    if unknown:
        raise ValueError(f"unknown header slot(s): {', '.join(sorted(unknown))} (header.html has {', '.join(known)})")
    return SLOT.sub(lambda m: f"<!-- slot:{m.group(1)} -->{page_slots.get(m.group(1), m.group(2))}<!-- /slot:{m.group(1)} -->", partial)


def compose(page, partial):
    """Return page with its md-header block re-rendered from partial."""
    m = BLOCK.search(page)
    if not m:
        raise ValueError("no <!-- md-header --> ... <!-- /md-header --> block")
    out = render(partial.rstrip("\n") + "\n", slots(m.group(1)))
    return page[:m.start()] + "<!-- md-header -->\n" + out + "<!-- /md-header -->" + page[m.end():]


def main(argv):
    check = "--check" in argv
    args = [a for a in argv if a != "--check"]
    if len(args) < 2:
        sys.exit(__doc__)
    partial = pathlib.Path(args[0]).read_text()
    stale = []
    for p in map(pathlib.Path, args[1:]):
        before = p.read_text()
        after = compose(before, partial)
        if after != before:
            if check:
                stale.append(str(p))
            else:
                p.write_text(after)
                print(f"compose: updated the header in {p}")
    if stale:
        sys.exit(f"compose: header differs from {args[0]} in: {', '.join(stale)}. Run python3 compose.py {args[0]} <page>.")


if __name__ == "__main__":
    main(sys.argv[1:])
