// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// One of these lives on each token's own chain. It mirrors that token's Pons trades and keeps a running hash,
/// so anyone can recompute the hash from the Pons logs and see the mirror is honest.
/// It does not settle anything: no balances, no transfers, no value. It is a record.
contract Ledger {
    struct Trade {
        bool buy;
        address wallet;
        uint256 quote; // quote amount of the trade, in the pair token's smallest unit
        uint256 tokens; // token amount, in the token's smallest unit
        uint64 ponsBlock;
        bytes32 ponsTx;
        uint32 ponsLogIndex;
    }

    address public immutable operator;
    address public immutable ponsToken;
    address public immutable ponsCurve;
    string public name;
    string public symbol;

    /// number of trades mirrored so far
    uint256 public count;
    /// hash of everything mirrored so far. It starts as a hash of the token and curve addresses, so a ledger cannot be reused for another token.
    bytes32 public head;

    event Mirrored(uint256 indexed n, bytes32 hash, bool buy, address indexed wallet, uint256 quote, uint256 tokens, uint64 ponsBlock, bytes32 ponsTx, uint32 ponsLogIndex);

    error NotOperator();

    constructor(address operator_, address ponsToken_, address ponsCurve_, string memory name_, string memory symbol_) {
        operator = operator_;
        ponsToken = ponsToken_;
        ponsCurve = ponsCurve_;
        name = name_;
        symbol = symbol_;
        head = keccak256(abi.encode("spawn", ponsToken_, ponsCurve_));
    }

    /// The hash that follows `prev` once `t` is added. The server and the verify page compute exactly this.
    function link(bytes32 prev, Trade memory t) public pure returns (bytes32) {
        return keccak256(abi.encode(prev, t.ponsTx, t.ponsLogIndex, t.buy ? uint8(1) : uint8(0), t.wallet, t.quote, t.tokens));
    }

    function mirror(Trade[] calldata trades) external {
        if (msg.sender != operator) revert NotOperator();
        bytes32 h = head;
        uint256 n = count;
        for (uint256 i = 0; i < trades.length; i++) {
            Trade calldata t = trades[i];
            h = link(h, t);
            emit Mirrored(++n, h, t.buy, t.wallet, t.quote, t.tokens, t.ponsBlock, t.ponsTx, t.ponsLogIndex);
        }
        head = h;
        count = n;
    }
}
