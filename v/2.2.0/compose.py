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


# Anything that looks like a marker, well formed or not, so a typo cannot slip past the strict pattern
ANY_SLOT = re.compile(r"<!--\s*/?\s*slot.*?-->", re.S | re.I)
ANY_BLOCK = re.compile(r"<!--\s*/?\s*md[-_]?header.*?-->", re.S | re.I)
MARKER = re.compile(r"<!-- (/?)slot:([\w-]+) -->")


class ComposeError(ValueError):
    """A page or partial whose markers cannot be composed safely. Nothing is written."""


def check_slots(src, where):
    """Every slot is one <!-- slot:x --> ... <!-- /slot:x --> pair: no typos, duplicates, nesting or strays.
    Anything else would make slots() miss the page's content and compose() replace it with the default."""
    loose = ANY_SLOT.findall(src)
    strict = MARKER.findall(src)
    if len(loose) != len(strict):
        bad = [m for m in loose if not MARKER.fullmatch(m)]
        raise ComposeError(f"{where}: malformed slot marker(s) {', '.join(bad)}; write <!-- slot:name --> and <!-- /slot:name -->")
    seen, open_ = set(), None
    for closing, name in strict:
        if not closing:
            if open_:
                raise ComposeError(f"{where}: slot '{name}' opens inside slot '{open_}' (slots cannot nest or be left open)")
            if name in seen:
                raise ComposeError(f"{where}: slot '{name}' appears more than once")
            seen.add(name)
            open_ = name
        else:
            if open_ != name:
                raise ComposeError(f"{where}: <!-- /slot:{name} --> without a matching <!-- slot:{name} -->")
            open_ = None
    if open_:
        raise ComposeError(f"{where}: slot '{open_}' is never closed")


def slots(src, where="page"):
    check_slots(src, where)
    return {m.group(1): m.group(2) for m in SLOT.finditer(src)}


def render(partial, page_slots):
    """The partial with every slot filled from page_slots (or the partial's default content)."""
    known = slots(partial, "header partial")
    unknown = set(page_slots) - set(known)
    if unknown:
        raise ComposeError(f"unknown header slot(s): {', '.join(sorted(unknown))} (header.html has {', '.join(known)})")
    return SLOT.sub(lambda m: f"<!-- slot:{m.group(1)} -->{page_slots.get(m.group(1), m.group(2))}<!-- /slot:{m.group(1)} -->", partial)


def compose(page, partial):
    """Return page with its md-header block re-rendered from partial."""
    markers = ANY_BLOCK.findall(page)
    if markers != ["<!-- md-header -->", "<!-- /md-header -->"]:
        raise ComposeError(f"page: expected one <!-- md-header --> ... <!-- /md-header --> block, found markers {markers or 'none'}")
    m = BLOCK.search(page)
    if not m:
        raise ComposeError("page: <!-- /md-header --> comes before <!-- md-header -->")
    out = render(partial.rstrip("\n") + "\n", slots(m.group(1), "page"))
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
        try:
            after = compose(before, partial)
        except ComposeError as e:
            sys.exit(f"compose: {p}: {e}")
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
