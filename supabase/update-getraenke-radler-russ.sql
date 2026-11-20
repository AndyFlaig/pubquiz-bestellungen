-- =====================================================================
--  Neue Getränke in die im Admin gespeicherte Preisliste einfügen:
--  Radler süß, Radler sauer (Preis wie Pils 0,5 l), Russ, Cola-Weizen (Preis wie Weizen 0,5 l)
--  Werden direkt nach „Weizen vom Fass 0,5 l“ einsortiert. Darf mehrfach ausgeführt werden.
-- =====================================================================
update public.einstellungen e
set wert = jsonb_set(e.wert, '{ARTIKEL}', (
      select jsonb_agg(x.elem order by x.ord, x.sub)
      from (
        -- bestehende Artikel in alter Reihenfolge
        select a.elem, a.ord, 0 as sub
        from jsonb_array_elements(e.wert->'ARTIKEL') with ordinality a(elem, ord)
        union all
        -- die vier neuen direkt hinter Weizen 0,5 l
        select n.elem, w.ord, n.sub
        from jsonb_array_elements(e.wert->'ARTIKEL') with ordinality w(elem, ord)
        cross join lateral (
          select (select q->'preis' from jsonb_array_elements(e.wert->'ARTIKEL') q where q->>'id' = 'pils05')   as pils,
                 (select q->'preis' from jsonb_array_elements(e.wert->'ARTIKEL') q where q->>'id' = 'weizen05') as weizen
        ) p
        cross join lateral (values
          (1, jsonb_build_object('id', 'radlersuess', 'kategorie', w.elem->'kategorie', 'name', 'Radler süß',   'menge', '0,5 l', 'preis', coalesce(p.pils,   '4'::jsonb), 'ziel', 'theke')),
          (2, jsonb_build_object('id', 'radlersauer', 'kategorie', w.elem->'kategorie', 'name', 'Radler sauer', 'menge', '0,5 l', 'preis', coalesce(p.pils,   '4'::jsonb), 'ziel', 'theke')),
          (3, jsonb_build_object('id', 'russ',        'kategorie', w.elem->'kategorie', 'name', 'Russ',         'menge', '0,5 l', 'preis', coalesce(p.weizen, '4'::jsonb), 'ziel', 'theke')),
          (4, jsonb_build_object('id', 'colaweizen',  'kategorie', w.elem->'kategorie', 'name', 'Cola-Weizen',  'menge', '0,5 l', 'preis', coalesce(p.weizen, '4'::jsonb), 'ziel', 'theke'))
        ) n(sub, elem)
        where w.elem->>'id' = 'weizen05'
      ) x
    )),
    geaendert_am = now()
where e.schluessel = 'stammdaten'
  and e.wert ? 'ARTIKEL'
  and exists (select 1 from jsonb_array_elements(e.wert->'ARTIKEL') q where q->>'id' = 'weizen05')
  and not exists (select 1 from jsonb_array_elements(e.wert->'ARTIKEL') q where q->>'id' in ('radlersuess', 'radlersauer', 'russ', 'colaweizen'));

-- Kontrolle: die Bier-Kategorie mit Preisen
select a->>'name' as artikel, a->>'menge' as menge, a->>'preis' as preis
from public.einstellungen e, jsonb_array_elements(e.wert->'ARTIKEL') with ordinality t(a, nr)
where e.schluessel = 'stammdaten' and a->>'kategorie' = (
  select q->>'kategorie' from jsonb_array_elements(e.wert->'ARTIKEL') q where q->>'id' = 'weizen05')
order by nr;
