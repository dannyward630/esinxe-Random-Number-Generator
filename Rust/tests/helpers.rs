use esinxe::{Key, Random};

#[test]
fn prepared_repeated_bounds_and_maximum_total_match_weighted_choice() {
    let field = Random::new(123).scope(&[Key::Str("weights")]);
    for weights in [[0, 0, 1, 0], [1, 0, 0, 1], [0, u64::MAX - 1, 1, 0]] {
        let items = [0, 1, 2, 3];
        let prepared = field.prepare_weighted_choice(&items, &weights).unwrap();
        for i in 0..200 {
            let keys = [Key::U64(i)];
            assert_eq!(
                Some(prepared.choose(&keys)),
                field.weighted_choice(&items, &weights, &keys)
            );
        }
    }
}

#[test]
fn scopes_sample_and_prepared_are_independent_snapshots() {
    let mut root = Random::new(42);
    let mut bytes = vec![1, 2];
    let mut scoped = root.scope(&[Key::Bytes(&bytes)]);
    let reference = Random::new(42).scope(&[Key::Bytes(&[1, 2])]);
    let nested = scoped.scope(&[Key::Str("nested")]);
    assert_eq!(
        nested.raw(&[Key::Str("k")]),
        reference.raw(&[Key::Str("nested"), Key::Str("k")])
    );
    let mut items = vec!["zero", "one", "two"];
    let mut weights = vec![0, 1, 3];
    let prepared = scoped.prepare_weighted_choice(&items, &weights).unwrap();
    bytes.fill(9);
    root.set_seed(9);
    assert_eq!(scoped.raw(&[]), reference.raw(&[]));
    items.fill("changed");
    weights.fill(0);
    scoped.set_seed(8);
    for i in 0..200 {
        assert_eq!(
            prepared.choose(&[Key::U64(i)]),
            reference
                .weighted_choice(&["zero", "one", "two"], &[0, 1, 3], &[Key::U64(i)])
                .unwrap()
        );
    }
    let mut nested = nested;
    assert_eq!(nested.next_raw(), Random::new(42).next_raw());
    assert_eq!(root.next_raw(), Random::new(9).next_raw());
    let values = [1, 1, 2, 3];
    let full = reference.sample(&values, values.len(), &[]).unwrap();
    for count in 0..=values.len() {
        assert_eq!(
            reference.sample(&values, count, &[]).unwrap(),
            full[..count]
        );
    }
    assert!(reference.sample(&values, 5, &[]).is_err());
    assert!(reference
        .prepare_weighted_choice(&values, &[0, 0, 0, 0])
        .is_err());
    assert!(reference
        .prepare_weighted_choice(&[1, 2], &[u64::MAX, 1])
        .is_err());
    assert!(reference.prepare_weighted_choice(&[1, 2], &[1]).is_err());
    assert!(reference.prepare_weighted_choice::<u8>(&[], &[]).is_err());
}
