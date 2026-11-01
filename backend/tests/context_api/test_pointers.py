from context_api.pcr.pointers import PointerStore


def test_issue_then_resolve_for_the_same_session():
    store = PointerStore()
    pointer = store.issue("s_1", "E-2231")
    assert pointer == "hist_s_1_E-2231"
    assert store.resolve("s_1", pointer).equipment_id == "E-2231"


def test_pointer_is_useless_to_another_session_and_unknown_pointers_resolve_to_none():
    store = PointerStore()
    pointer = store.issue("s_1", "E-2231")
    assert store.resolve("s_2", pointer) is None
    assert store.resolve("s_1", "hist_s_1_E-9999") is None


def test_sequence_numbers_count_per_session():
    store = PointerStore()
    assert [store.next_seq("s_1"), store.next_seq("s_1"), store.next_seq("s_2")] == [1, 2, 1]
