'use strict';

// Loaded by CAP before connect. Force HANA impl so @cap-js/sqlite cannot
// keep impl=sqlite while kind=hana (that crashes on the JDBC driver field).
module.exports = {
  features: {
    in_memory_db: false,
    with_mocks: false,
    test_data: false,
    test_mocks: false,
    mocked_bindings: false,
  },
  fiori: {
    lean_draft: false,
    preview: false,
  },
  requires: {
    db: {
      kind: 'hana',
      impl: '@cap-js/hana',
    },
  },
};
