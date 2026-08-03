(function () {
  'use strict';

  function parseMarked(source) {
    const anchors = {};
    const lines = String(source).replace(/^\n|\n\s*$/g, '').split('\n').map((raw, index) => {
      const blockMarker = raw.match(/\s*\/\*\s*@([0-9,\s]+)\s*\*\/\s*$/);
      const trailingMarker = raw.match(/\s*@([0-9,\s]+)\s*$/);
      const marker = blockMarker || trailingMarker;
      if (marker) {
        marker[1].split(',').map(Number).filter(Number.isFinite).forEach(key => {
          (anchors[key] ||= []).push(index);
        });
        return raw.slice(0, marker.index).replace(/\s+$/, '');
      }
      return raw;
    });
    return { lines, anchors };
  }

  function pack(cpp, java, python) {
    return {
      cpp: { id:'cpp', label:'C/C++', standard:'C++17', ...parseMarked(cpp) },
      java: { id:'java', label:'Java', standard:'Java 17', ...parseMarked(java) },
      python: { id:'python', label:'Python', standard:'Python 3', ...parseMarked(python) }
    };
  }

  function sequenceCode() {
    return pack(`
#include <algorithm>
#include <cstddef>
#include <vector>

class SeqList {
public:
    explicit SeqList(std::size_t capacity = 10)
        : data_(capacity), length_(0) {} /*@0*/

    bool insert(std::size_t pos, int value) {
        if (pos > length_) return false; /*@1*/
        if (length_ == data_.size())
            data_.resize(std::max<std::size_t>(1, data_.size() * 2)); /*@2*/
        for (std::size_t i = length_; i > pos; --i) /*@3*/
            data_[i] = data_[i - 1]; /*@4*/
        data_[pos] = value; /*@5*/
        ++length_; /*@6*/
        return true; /*@7*/
    } /*@8*/

private:
    std::vector<int> data_;
    std::size_t length_;
};`, `
import java.util.Arrays;

public final class SeqList {
    private int[] data;
    private int length;

    public SeqList(int capacity) {
        data = new int[Math.max(1, capacity)];
        length = 0; /*@0*/
    }

    public boolean insert(int pos, int value) {
        if (pos < 0 || pos > length) return false; /*@1*/
        if (length == data.length)
            data = Arrays.copyOf(data, data.length * 2); /*@2*/
        for (int i = length; i > pos; i--) /*@3*/
            data[i] = data[i - 1]; /*@4*/
        data[pos] = value; /*@5*/
        length++; /*@6*/
        return true; /*@7*/
    } /*@8*/
}`, `
class SeqList:
    def __init__(self, capacity: int = 10) -> None:
        self._data = [None] * max(1, capacity)
        self.length = 0  # @0

    def insert(self, pos: int, value: int) -> bool:
        if pos < 0 or pos > self.length:
            return False  # @1
        if self.length == len(self._data):
            self._data.extend([None] * len(self._data))  # @2
        for i in range(self.length, pos, -1):  # @3
            self._data[i] = self._data[i - 1]  # @4
        self._data[pos] = value  # @5
        self.length += 1  # @6
        return True  # @7
        # function end  @8`);
  }

  function linkedCode(doubly) {
    if (doubly) return pack(`
#include <cstddef>

struct Node {
    int value;
    Node* prev;
    Node* next;
};

bool insertAfter(Node* p, int value, std::size_t& length) {
    if (p == nullptr) return false; /*@0*/
    Node* s = new Node{value, nullptr, nullptr}; /*@1*/
    s->next = p->next; /*@2*/
    s->prev = p; /*@3*/
    if (p->next != nullptr) p->next->prev = s; /*@4*/
    p->next = s; /*@5*/
    ++length; /*@6*/
    return true;
}`, `
public final class DoublyList {
    static final class Node {
        int value;
        Node prev;
        Node next;
        Node(int value) { this.value = value; }
    }

    private int length;

    public boolean insertAfter(Node p, int value) {
        if (p == null) return false; /*@0*/
        Node s = new Node(value); /*@1*/
        s.next = p.next; /*@2*/
        s.prev = p; /*@3*/
        if (p.next != null) p.next.prev = s; /*@4*/
        p.next = s; /*@5*/
        length++; /*@6*/
        return true;
    }
}`, `
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    value: int
    prev: Optional["Node"] = None
    next: Optional["Node"] = None

class DoublyList:
    def __init__(self) -> None:
        self.length = 0

    def insert_after(self, p: Optional[Node], value: int) -> bool:
        if p is None:
            return False  # @0
        s = Node(value)  # @1
        s.next = p.next  # @2
        s.prev = p  # @3
        if p.next is not None:
            p.next.prev = s  # @4
        p.next = s  # @5
        self.length += 1  # @6
        return True`);

    return pack(`
#include <cstddef>

struct Node { int value; Node* next; };

bool insertAfter(Node* p, int value, std::size_t& length) {
    if (p == nullptr) return false; /*@0*/
    Node* s = new Node{value, nullptr}; /*@1*/
    s->next = p->next; /*@2*/
    // 单链表不维护 prev。 /*@3,4*/
    p->next = s; /*@5*/
    ++length; /*@6*/
    return true;
}`, `
public final class SinglyList {
    static final class Node {
        int value;
        Node next;
        Node(int value) { this.value = value; }
    }

    private int length;

    public boolean insertAfter(Node p, int value) {
        if (p == null) return false; /*@0*/
        Node s = new Node(value); /*@1*/
        s.next = p.next; /*@2*/
        // 单链表不维护 prev。 /*@3,4*/
        p.next = s; /*@5*/
        length++; /*@6*/
        return true;
    }
}`, `
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    value: int
    next: Optional["Node"] = None

class SinglyList:
    def __init__(self) -> None:
        self.length = 0

    def insert_after(self, p: Optional[Node], value: int) -> bool:
        if p is None:
            return False  # @0
        s = Node(value)  # @1
        s.next = p.next  # @2
        # 单链表不维护 prev。  # @3,4
        p.next = s  # @5
        self.length += 1  # @6
        return True`);
  }

  function staticListCode() {
    return pack(`
#include <array>

struct CursorNode { int data; int next; };

void traverse(const std::array<CursorNode, 6>& cursor, int head) {
    int p = head; /*@0*/
    while (p != -1) { /*@1*/
        volatile int value = cursor[p].data; /*@2*/
        p = cursor[p].next; /*@3*/
    } /*@4*/
}`, `
public final class StaticList {
    record CursorNode(int data, int next) {}

    static void traverse(CursorNode[] cursor, int head) {
        int p = head; /*@0*/
        while (p != -1) { /*@1*/
            System.out.println(cursor[p].data()); /*@2*/
            p = cursor[p].next(); /*@3*/
        } /*@4*/
    }
}`, `
from dataclasses import dataclass

@dataclass
class CursorNode:
    data: int
    next: int

def traverse(cursor: list[CursorNode], head: int) -> None:
    p = head  # @0
    while p != -1:  # @1
        print(cursor[p].data)  # @2
        p = cursor[p].next  # @3
    # loop end  @4`);
  }

  function stackCode() {
    return pack(`
#include <stdexcept>
#include <vector>

class Stack {
public:
    void push(int x) { /*@0*/
        data_.push_back(x); /*@1*/
    } /*@2*/

    int pop() { /*@3*/
        if (data_.empty()) throw std::underflow_error("empty stack");
        int x = data_.back(); data_.pop_back(); return x; /*@4*/
    } /*@5*/
private:
    std::vector<int> data_;
};`, `
import java.util.ArrayDeque;
import java.util.Deque;

public final class IntStack {
    private final Deque<Integer> data = new ArrayDeque<>();

    public void push(int x) { /*@0*/
        data.push(x); /*@1*/
    } /*@2*/

    public int pop() { /*@3*/
        if (data.isEmpty()) throw new IllegalStateException("empty stack");
        return data.pop(); /*@4*/
    } /*@5*/
}`, `
class Stack:
    def __init__(self) -> None:
        self._data: list[int] = []

    def push(self, x: int) -> None:  # @0
        self._data.append(x)  # @1
        # push end  @2

    def pop(self) -> int:  # @3
        if not self._data:
            raise IndexError("empty stack")
        return self._data.pop()  # @4
        # pop end  @5`);
  }

  function queueCode(dequeMode) {
    if (dequeMode) return pack(`
#include <deque>

void demo(std::deque<int>& q) {
    q.push_back(77); /*@0*/
    q.push_front(6); /*@1*/
    int right = q.back(); q.pop_back(); /*@2*/
    int left = q.front(); q.pop_front(); /*@3*/
    (void)right; (void)left;
}`, `
import java.util.ArrayDeque;
import java.util.Deque;

public final class DequeDemo {
    static void demo(Deque<Integer> deque) {
        deque.addLast(77); /*@0*/
        deque.addFirst(6); /*@1*/
        int right = deque.removeLast(); /*@2*/
        int left = deque.removeFirst(); /*@3*/
    }
}`, `
from collections import deque

def demo(q: deque[int]) -> None:
    q.append(77)  # @0
    q.appendleft(6)  # @1
    right = q.pop()  # @2
    left = q.popleft()  # @3`);

    return pack(`
#include <stdexcept>
#include <vector>

class CircularQueue {
public:
    explicit CircularQueue(int capacity) : data_(capacity) {}
    void enqueue(int value) {
        data_[rear_] = value; /*@0*/
        rear_ = (rear_ + 1) % data_.size(); /*@1*/
    }
    int dequeue() {
        if (front_ == rear_) throw std::underflow_error("empty queue");
        int value = data_[front_]; /*@2*/
        front_ = (front_ + 1) % data_.size(); /*@3*/
        return value;
    }
private:
    std::vector<int> data_;
    std::size_t front_ = 0, rear_ = 0;
};`, `
public final class CircularQueue {
    private final int[] data;
    private int front;
    private int rear;

    public CircularQueue(int capacity) { data = new int[capacity]; }

    public void enqueue(int value) {
        data[rear] = value; /*@0*/
        rear = (rear + 1) % data.length; /*@1*/
    }

    public int dequeue() {
        if (front == rear) throw new IllegalStateException("empty queue");
        int value = data[front]; /*@2*/
        front = (front + 1) % data.length; /*@3*/
        return value;
    }
}`, `
class CircularQueue:
    def __init__(self, capacity: int) -> None:
        self.data = [0] * capacity
        self.front = 0
        self.rear = 0

    def enqueue(self, value: int) -> None:
        self.data[self.rear] = value  # @0
        self.rear = (self.rear + 1) % len(self.data)  # @1

    def dequeue(self) -> int:
        if self.front == self.rear:
            raise IndexError("empty queue")
        value = self.data[self.front]  # @2
        self.front = (self.front + 1) % len(self.data)  # @3
        return value`);
  }

  function bracketCode() {
    return pack(`
#include <stack>
#include <string>

bool bracketsMatch(const std::string& text) {
    std::stack<char> stack;
    for (char ch : text) { /*@0*/
        if (ch == '(' || ch == '[' || ch == '{') stack.push(ch); /*@1*/
        else if (stack.empty()) return false; /*@2*/
        else {
            char left = stack.top(); stack.pop();
            if ((left=='('&&ch!=')') || (left=='['&&ch!=']') || (left=='{'&&ch!='}')) return false; /*@3*/
        }
    } /*@4*/
    return stack.empty(); /*@5*/
}`, `
import java.util.ArrayDeque;
import java.util.Deque;

public final class Brackets {
    static boolean matches(String text) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char ch : text.toCharArray()) { /*@0*/
            if ("([{ ".indexOf(ch) >= 0 && ch != ' ') stack.push(ch); /*@1*/
            else if (stack.isEmpty()) return false; /*@2*/
            else {
                char left = stack.pop();
                if (!pair(left, ch)) return false; /*@3*/
            }
        } /*@4*/
        return stack.isEmpty(); /*@5*/
    }
    private static boolean pair(char a, char b) {
        return (a=='('&&b==')') || (a=='['&&b==']') || (a=='{'&&b=='}');
    }
}`, `
def brackets_match(text: str) -> bool:
    stack: list[str] = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in text:  # @0
        if ch in "([{":
            stack.append(ch)  # @1
        elif not stack:
            return False  # @2
        elif stack.pop() != pairs.get(ch):
            return False  # @3
    # loop end  @4
    return not stack  # @5`);
  }

  function expressionCode() {
    return pack(`
#include <stack>
#include <string>

int evaluate(const std::string& expression) {
    std::stack<int> numbers;
    std::stack<char> operators;
    for (char token : expression) { /*@0*/
        if (token >= '0' && token <= '9') numbers.push(token - '0'); /*@1*/
        else if (token == '+' || token == '*') {
            while (!operators.empty() && operators.top() == '*') { /*@2*/
                int b=numbers.top(); numbers.pop(); int a=numbers.top(); numbers.pop();
                numbers.push(a*b); operators.pop();
            }
            operators.push(token); /*@3*/
        }
    }
    while (!operators.empty()) { /*@4*/
        int b=numbers.top(); numbers.pop(); int a=numbers.top(); numbers.pop();
        char op=operators.top(); operators.pop(); numbers.push(op=='+'?a+b:a*b);
    }
    return numbers.top();
}`, `
import java.util.ArrayDeque;
import java.util.Deque;

public final class Expression {
    static int evaluate(String expression) {
        Deque<Integer> numbers = new ArrayDeque<>();
        Deque<Character> operators = new ArrayDeque<>();
        for (char token : expression.toCharArray()) { /*@0*/
            if (Character.isDigit(token)) numbers.push(token - '0'); /*@1*/
            else if (token == '+' || token == '*') {
                while (!operators.isEmpty() && operators.peek() == '*') reduce(numbers, operators); /*@2*/
                operators.push(token); /*@3*/
            }
        }
        while (!operators.isEmpty()) reduce(numbers, operators); /*@4*/
        return numbers.pop();
    }
    private static void reduce(Deque<Integer> n, Deque<Character> o) {
        int b=n.pop(), a=n.pop(); char op=o.pop(); n.push(op=='+'?a+b:a*b);
    }
}`, `
def evaluate(expression: str) -> int:
    numbers: list[int] = []
    operators: list[str] = []
    for token in expression:  # @0
        if token.isdigit():
            numbers.append(int(token))  # @1
        elif token in "+*":
            while operators and operators[-1] == "*":  # @2
                b, a = numbers.pop(), numbers.pop()
                numbers.append(a * b)
                operators.pop()
            operators.append(token)  # @3
    while operators:  # @4
        b, a = numbers.pop(), numbers.pop()
        op = operators.pop()
        numbers.append(a + b if op == "+" else a * b)
    return numbers[-1]`);
  }

  function matrixCode(kind) {
    const formulas = {
      'array-storage': ['return i * columns + j;', 'return storage[index];', 'return i * columns + j', 'return storage[index]'],
      symmetric: ['if (i < j) std::swap(i, j); return i * (i + 1) / 2 + j;', 'return storage[index];', 'if (i < j) { int t=i; i=j; j=t; } return i * (i + 1) / 2 + j;', 'return storage[index];', 'if i < j: i, j = j, i\n    return i * (i + 1) // 2 + j', 'return storage[index]'],
      triangular: ['if (i >= j) return i * (i + 1) / 2 + j; return -1;', 'return index < 0 ? constant : storage[index];', 'if (i >= j) return i * (i + 1) / 2 + j; return -1;', 'return index < 0 ? constant : storage[index];', 'return i * (i + 1) // 2 + j if i >= j else -1', 'return constant if index < 0 else storage[index]'],
      tridiagonal: ['if (std::abs(i-j) <= 1) return 2*i+j; return -1;', 'return index < 0 ? 0 : storage[index];', 'if (Math.abs(i-j) <= 1) return 2*i+j; return -1;', 'return index < 0 ? 0 : storage[index];', 'return 2 * i + j if abs(i - j) <= 1 else -1', 'return 0 if index < 0 else storage[index]'],
      sparse: ['if (value != 0) triples.push_back({i,j,value});', 'return triples;', 'if (value != 0) triples.add(new Triple(i,j,value));', 'return triples;', 'if value != 0: triples.append((i, j, value))', 'return triples']
    };
    const f = formulas[kind] || formulas['array-storage'];
    if (kind === 'sparse') return pack(`
#include <tuple>
#include <vector>
using Triple = std::tuple<int,int,int>;

std::vector<Triple> compress(const std::vector<std::vector<int>>& matrix) {
    std::vector<Triple> triples;
    for (int i=0; i<(int)matrix.size(); ++i)
        for (int j=0; j<(int)matrix[i].size(); ++j)
            ${f[0]} /*@0*/
    ${f[1]} /*@1*/
}`, `
import java.util.ArrayList;
import java.util.List;

public final class SparseMatrix {
    record Triple(int row, int column, int value) {}
    static List<Triple> compress(int[][] matrix) {
        List<Triple> triples = new ArrayList<>();
        for (int i=0; i<matrix.length; i++)
            for (int j=0; j<matrix[i].length; j++)
                ${f[2]} /*@0*/
        ${f[3]} /*@1*/
    }
}`, `
def compress(matrix: list[list[int]]) -> list[tuple[int, int, int]]:
    triples: list[tuple[int, int, int]] = []
    for i, row in enumerate(matrix):
        for j, value in enumerate(row):
            ${f[4]}  # @0
    ${f[5]}  # @1`);
    return pack(`
#include <algorithm>
#include <cstdlib>
#include <vector>

int indexOf(int i, int j, int columns) {
    ${f[0]} /*@0*/
}
int get(const std::vector<int>& storage, int i, int j, int columns, int constant=0) {
    int index = indexOf(i, j, columns);
    ${f[1]} /*@1*/
}`, `
public final class CompressedMatrix {
    static int indexOf(int i, int j, int columns) {
        ${f[2]} /*@0*/
    }
    static int get(int[] storage, int i, int j, int columns, int constant) {
        int index = indexOf(i, j, columns);
        ${f[3]} /*@1*/
    }
}`, `
def index_of(i: int, j: int, columns: int) -> int:
    ${f[4]}  # @0

def get(storage: list[int], i: int, j: int, columns: int, constant: int = 0) -> int:
    index = index_of(i, j, columns)
    ${f[5]}  # @1`);
  }

  function stringCode(kmp) {
    if (kmp) return pack(`
#include <string>
#include <vector>

int kmp(const std::string& text, const std::string& pattern, const std::vector<int>& next) {
    int i = 0, j = 0; /*@0*/
    while (i < (int)text.size() && j < (int)pattern.size()) { /*@1*/
        if (j == -1 || text[i] == pattern[j]) { ++i; ++j; } /*@2*/
        else j = next[j]; /*@3*/
    } /*@4*/
    return j == (int)pattern.size() ? i - j : -1; /*@5*/
}`, `
public final class Kmp {
    static int search(String text, String pattern, int[] next) {
        int i = 0, j = 0; /*@0*/
        while (i < text.length() && j < pattern.length()) { /*@1*/
            if (j == -1 || text.charAt(i) == pattern.charAt(j)) { i++; j++; } /*@2*/
            else j = next[j]; /*@3*/
        } /*@4*/
        return j == pattern.length() ? i - j : -1; /*@5*/
    }
}`, `
def kmp(text: str, pattern: str, next_: list[int]) -> int:
    i = j = 0  # @0
    while i < len(text) and j < len(pattern):  # @1
        if j == -1 or text[i] == pattern[j]:
            i, j = i + 1, j + 1  # @2
        else:
            j = next_[j]  # @3
    # loop end  @4
    return i - j if j == len(pattern) else -1  # @5`);
    return pack(`
#include <string>

int naiveSearch(const std::string& text, const std::string& pattern) {
    for (int i=0; i <= (int)text.size()-(int)pattern.size(); ++i) { /*@0*/
        int j = 0; /*@1*/
        while (j < (int)pattern.size() && text[i+j] == pattern[j]) ++j; /*@2*/
        if (j == (int)pattern.size()) return i; /*@3*/
    } /*@4*/
    return -1; /*@5*/
}`, `
public final class NaiveMatch {
    static int search(String text, String pattern) {
        for (int i=0; i<=text.length()-pattern.length(); i++) { /*@0*/
            int j = 0; /*@1*/
            while (j<pattern.length() && text.charAt(i+j)==pattern.charAt(j)) j++; /*@2*/
            if (j == pattern.length()) return i; /*@3*/
        } /*@4*/
        return -1; /*@5*/
    }
}`, `
def naive_search(text: str, pattern: str) -> int:
    for i in range(len(text) - len(pattern) + 1):  # @0
        j = 0  # @1
        while j < len(pattern) and text[i + j] == pattern[j]:
            j += 1  # @2
        if j == len(pattern):
            return i  # @3
    # loop end  @4
    return -1  # @5`);
  }

  function treeCode(kind) {
    if (kind === 'level-order') return pack(`
#include <queue>
struct Node { int key; Node* left; Node* right; };

void levelOrder(Node* root) {
    if (!root) return;
    std::queue<Node*> queue; queue.push(root); /*@0*/
    while (!queue.empty()) { /*@1*/
        Node* p=queue.front(); queue.pop(); /*@2*/
        volatile int value=p->key; /*@3*/
        if (p->left) queue.push(p->left); /*@4*/
        if (p->right) queue.push(p->right); /*@5*/
    } /*@6*/
}`, `
import java.util.ArrayDeque;
import java.util.Queue;

public final class LevelOrder {
    record Node(int key, Node left, Node right) {}
    static void traverse(Node root) {
        if (root == null) return;
        Queue<Node> queue = new ArrayDeque<>(); queue.offer(root); /*@0*/
        while (!queue.isEmpty()) { /*@1*/
            Node p = queue.poll(); /*@2*/
            System.out.println(p.key()); /*@3*/
            if (p.left() != null) queue.offer(p.left()); /*@4*/
            if (p.right() != null) queue.offer(p.right()); /*@5*/
        } /*@6*/
    }
}`, `
from collections import deque
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    key: int
    left: Optional["Node"] = None
    right: Optional["Node"] = None

def level_order(root: Optional[Node]) -> None:
    if root is None: return
    queue = deque([root])  # @0
    while queue:  # @1
        p = queue.popleft()  # @2
        print(p.key)  # @3
        if p.left: queue.append(p.left)  # @4
        if p.right: queue.append(p.right)  # @5
    # loop end  @6`);

    if (kind === 'threaded') return pack(`
struct Node { int key; Node* left; Node* right; bool ltag=false, rtag=false; };
Node* predecessor = nullptr;

void thread(Node* node) { /*@0*/
    if (!node) return;
    thread(node->left);
    if (!node->left) { node->left=predecessor; node->ltag=true; } /*@1*/
    if (predecessor && !predecessor->right) { predecessor->right=node; predecessor->rtag=true; } /*@2*/
    predecessor=node; thread(node->right);
}`, `
public final class ThreadedTree {
    static final class Node { int key; Node left,right; boolean ltag,rtag; }
    private Node predecessor;

    void thread(Node node) { /*@0*/
        if (node == null) return;
        thread(node.left);
        if (node.left == null) { node.left=predecessor; node.ltag=true; } /*@1*/
        if (predecessor != null && predecessor.right == null) { predecessor.right=node; predecessor.rtag=true; } /*@2*/
        predecessor=node; thread(node.right);
    }
}`, `
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    key: int
    left: Optional["Node"] = None
    right: Optional["Node"] = None
    ltag: bool = False
    rtag: bool = False

def thread(node: Optional[Node], predecessor: list[Optional[Node]]) -> None:  # @0
    if node is None: return
    thread(node.left, predecessor)
    if node.left is None:
        node.left, node.ltag = predecessor[0], True  # @1
    if predecessor[0] is not None and predecessor[0].right is None:
        predecessor[0].right, predecessor[0].rtag = node, True  # @2
    predecessor[0] = node
    thread(node.right, predecessor)`);

    return pack(`
struct Node { int key; Node* left; Node* right; };

void preorder(Node* root) { /*@0*/
    if (root == nullptr) return; /*@1*/
    volatile int value = root->key; /*@2*/
    preorder(root->left); /*@3*/
    preorder(root->right); /*@4*/
} /*@5*/`, `
public final class BinaryTree {
    record Node(int key, Node left, Node right) {}

    static void preorder(Node root) { /*@0*/
        if (root == null) return; /*@1*/
        System.out.println(root.key()); /*@2*/
        preorder(root.left()); /*@3*/
        preorder(root.right()); /*@4*/
    } /*@5*/
}`, `
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    key: int
    left: Optional["Node"] = None
    right: Optional["Node"] = None

def preorder(root: Optional[Node]) -> None:  # @0
    if root is None: return  # @1
    print(root.key)  # @2
    preorder(root.left)  # @3
    preorder(root.right)  # @4
    # function end  @5`);
  }

  function searchTreeCode(kind) {
    if (kind === 'huffman') return pack(`
#include <memory>
#include <queue>
#include <vector>
struct Node { int weight; std::shared_ptr<Node> left,right; };

std::shared_ptr<Node> build(std::vector<int> weights) {
    auto cmp=[](auto a,auto b){return a->weight>b->weight;};
    std::priority_queue<std::shared_ptr<Node>,std::vector<std::shared_ptr<Node>>,decltype(cmp)> heap(cmp); /*@0*/
    for(int w:weights) heap.push(std::make_shared<Node>(Node{w,{},{}}));
    while (heap.size() > 1) { /*@1*/
        auto a=heap.top(); heap.pop(); /*@2*/
        auto b=heap.top(); heap.pop(); /*@3*/
        heap.push(std::make_shared<Node>(Node{a->weight+b->weight,a,b})); /*@4*/
    } /*@5*/
    return heap.top();
}`, `
import java.util.PriorityQueue;
import java.util.List;

public final class Huffman {
    record Node(int weight, Node left, Node right) implements Comparable<Node> {
        public int compareTo(Node other) { return Integer.compare(weight, other.weight); }
    }
    static Node build(List<Integer> weights) {
        PriorityQueue<Node> heap = new PriorityQueue<>(); /*@0*/
        weights.forEach(w -> heap.offer(new Node(w, null, null)));
        while (heap.size() > 1) { /*@1*/
            Node a = heap.poll(); /*@2*/
            Node b = heap.poll(); /*@3*/
            heap.offer(new Node(a.weight()+b.weight(), a, b)); /*@4*/
        } /*@5*/
        return heap.poll();
    }
}`, `
from dataclasses import dataclass, field
import heapq

@dataclass(order=True)
class Node:
    weight: int
    left: "Node | None" = field(compare=False, default=None)
    right: "Node | None" = field(compare=False, default=None)

def build(weights: list[int]) -> Node:
    heap = [Node(w) for w in weights]
    heapq.heapify(heap)  # @0
    while len(heap) > 1:  # @1
        a = heapq.heappop(heap)  # @2
        b = heapq.heappop(heap)  # @3
        heapq.heappush(heap, Node(a.weight + b.weight, a, b))  # @4
    # loop end  @5
    return heap[0]`);

    if (kind === 'avl') return pack(`
struct Node { int key, height = 1; Node* left = nullptr; Node* right = nullptr; };
int height(Node* n) { return n ? n->height : 0; }
Node* rotateRight(Node* y);  // 右旋：y 的左孩子 x 上提为子树根
Node* rotateLeft(Node* x);   // 左旋：x 的右孩子 y 上提为子树根

Node* insert(Node* root, int key) { /*@0*/
    if (!root) return new Node{key}; /*@1*/
    if (key < root->key) root->left = insert(root->left, key); /*@2*/
    else root->right = insert(root->right, key);
    root->height = 1 + std::max(height(root->left), height(root->right)); /*@3*/
    int balance = height(root->left) - height(root->right); /*@4*/
    if (balance > 1 && key < root->left->key) return rotateRight(root); /*@5*/
    if (balance < -1 && key > root->right->key) return rotateLeft(root); /*@6*/
    if (balance > 1) { root->left = rotateLeft(root->left); return rotateRight(root); } /*@7*/
    if (balance < -1) { root->right = rotateRight(root->right); return rotateLeft(root); } /*@8*/
    return root; /*@9*/
}
Node* rotateRight(Node* y) { Node* x = y->left; y->left = x->right; x->right = y;
    y->height = 1 + std::max(height(y->left), height(y->right));
    x->height = 1 + std::max(height(x->left), height(x->right)); return x; }
Node* rotateLeft(Node* x) { Node* y = x->right; x->right = y->left; y->left = x;
    x->height = 1 + std::max(height(x->left), height(x->right));
    y->height = 1 + std::max(height(y->left), height(y->right)); return y; }`, `
public final class AvlTree {
    static final class Node { int key, height = 1; Node left, right; Node(int k) { key = k; } }
    static int height(Node n) { return n == null ? 0 : n.height; }
    static Node rotateRight(Node y) { Node x = y.left; y.left = x.right; x.right = y;
        y.height = 1 + Math.max(height(y.left), height(y.right));
        x.height = 1 + Math.max(height(x.left), height(x.right)); return x; }
    static Node rotateLeft(Node x) { Node y = x.right; x.right = y.left; y.left = x;
        x.height = 1 + Math.max(height(x.left), height(x.right));
        y.height = 1 + Math.max(height(y.left), height(y.right)); return y; }

    static Node insert(Node root, int key) { /*@0*/
        if (root == null) return new Node(key); /*@1*/
        if (key < root.key) root.left = insert(root.left, key); /*@2*/
        else root.right = insert(root.right, key);
        root.height = 1 + Math.max(height(root.left), height(root.right)); /*@3*/
        int balance = height(root.left) - height(root.right); /*@4*/
        if (balance > 1 && key < root.left.key) return rotateRight(root); /*@5*/
        if (balance < -1 && key > root.right.key) return rotateLeft(root); /*@6*/
        if (balance > 1) { root.left = rotateLeft(root.left); return rotateRight(root); } /*@7*/
        if (balance < -1) { root.right = rotateRight(root.right); return rotateLeft(root); } /*@8*/
        return root; /*@9*/
    }
}`, `
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    key: int
    left: Optional["Node"] = None
    right: Optional["Node"] = None
    height: int = 1

def height(n: Optional[Node]) -> int:
    return n.height if n else 0

def rotate_right(y: Node) -> Node:
    x = y.left; y.left = x.right; x.right = y
    y.height = 1 + max(height(y.left), height(y.right))
    x.height = 1 + max(height(x.left), height(x.right))
    return x

def rotate_left(x: Node) -> Node:
    y = x.right; x.right = y.left; y.left = x
    x.height = 1 + max(height(x.left), height(x.right))
    y.height = 1 + max(height(y.left), height(y.right))
    return y

def insert(root: Optional[Node], key: int) -> Node:  # @0
    if root is None: return Node(key)  # @1
    if key < root.key: root.left = insert(root.left, key)  # @2
    else: root.right = insert(root.right, key)
    root.height = 1 + max(height(root.left), height(root.right))  # @3
    balance = height(root.left) - height(root.right)  # @4
    if balance > 1 and key < root.left.key: return rotate_right(root)  # @5
    if balance < -1 and key > root.right.key: return rotate_left(root)  # @6
    if balance > 1: root.left = rotate_left(root.left); return rotate_right(root)  # @7
    if balance < -1: root.right = rotate_right(root.right); return rotate_left(root)  # @8
    return root  # @9`);

    if (kind === 'red-black') return pack(`
enum Color { RED, BLACK };
struct Node { int key; Color color=RED; Node* left=nullptr; Node* right=nullptr; };
Node* rotateLeft(Node* root);

Node* insertDemo(Node* root) {
    root = new Node{10, BLACK}; /*@0*/
    root->right = new Node{20, RED}; /*@1*/
    root->right->right = new Node{30, RED}; /*@2*/
    root = rotateLeft(root); root->color=BLACK; root->left->color=RED; /*@3*/
    return root;
}`, `
public final class RedBlackDemo {
    enum Color { RED, BLACK }
    static final class Node { int key; Color color=Color.RED; Node left,right; Node(int k){key=k;} }
    static Node rotateLeft(Node root) { Node x=root.right; root.right=x.left; x.left=root; return x; }

    static Node demo() {
        Node root = new Node(10); root.color=Color.BLACK; /*@0*/
        root.right = new Node(20); /*@1*/
        root.right.right = new Node(30); /*@2*/
        root=rotateLeft(root); root.color=Color.BLACK; root.left.color=Color.RED; /*@3*/
        return root;
    }
}`, `
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    key: int
    color: str = "RED"
    left: Optional["Node"] = None
    right: Optional["Node"] = None

def demo() -> Node:
    root = Node(10, "BLACK")  # @0
    root.right = Node(20)  # @1
    root.right.right = Node(30)  # @2
    root = rotate_left(root); root.color="BLACK"; root.left.color="RED"  # @3
    return root`);

    if (kind === 'b-tree') return pack(`
#include <algorithm>
#include <vector>
struct Node { std::vector<int> keys; std::vector<Node*> children; };

void insertDemo(Node*& root) {
    root = new Node{{10},{}}; /*@0*/
    root->keys.push_back(20); /*@1*/
    root->keys.push_back(30); std::sort(root->keys.begin(),root->keys.end()); /*@2*/
    root = new Node{{20},{new Node{{10},{}},new Node{{30},{}}}}; /*@3*/
}`, `
import java.util.ArrayList;
import java.util.List;

public final class BTreeDemo {
    static final class Node { List<Integer> keys=new ArrayList<>(); List<Node> children=new ArrayList<>(); }
    static Node demo() {
        Node root=new Node(); root.keys.add(10); /*@0*/
        root.keys.add(20); /*@1*/
        root.keys.add(30); root.keys.sort(Integer::compareTo); /*@2*/
        Node parent=new Node(); parent.keys.add(20); parent.children.add(node(10)); parent.children.add(node(30)); root=parent; /*@3*/
        return root;
    }
    static Node node(int key){Node n=new Node();n.keys.add(key);return n;}
}`, `
from dataclasses import dataclass, field

@dataclass
class Node:
    keys: list[int] = field(default_factory=list)
    children: list["Node"] = field(default_factory=list)

def demo() -> Node:
    root = Node([10])  # @0
    root.keys.append(20)  # @1
    root.keys.append(30); root.keys.sort()  # @2
    root = Node([20], [Node([10]), Node([30])])  # @3
    return root`);

    return pack(`
struct Node { int key; Node* left=nullptr; Node* right=nullptr; };

Node* insert(Node* root, int x) { /*@0*/
    if (root == nullptr) return new Node{x}; /*@1*/
    if (x < root->key) root->left = insert(root->left, x); /*@2*/
    else if (x > root->key) root->right = insert(root->right, x); /*@3*/
    return root; /*@4*/
} /*@5*/`, `
public final class Bst {
    static final class Node { int key; Node left,right; Node(int key){this.key=key;} }
    static Node insert(Node root, int x) { /*@0*/
        if (root == null) return new Node(x); /*@1*/
        if (x < root.key) root.left=insert(root.left,x); /*@2*/
        else if (x > root.key) root.right=insert(root.right,x); /*@3*/
        return root; /*@4*/
    } /*@5*/
}`, `
from dataclasses import dataclass
from typing import Optional

@dataclass
class Node:
    key: int
    left: Optional["Node"] = None
    right: Optional["Node"] = None

def insert(root: Optional[Node], x: int) -> Node:  # @0
    if root is None: return Node(x)  # @1
    if x < root.key: root.left = insert(root.left, x)  # @2
    elif x > root.key: root.right = insert(root.right, x)  # @3
    return root  # @4
    # function end  @5`);
  }

  function graphStorageCode(matrix) {
    if (matrix) return pack(`
#include <vector>
void addUndirectedEdge(std::vector<std::vector<int>>& matrix, int u, int v, int weight) {
    matrix[u][v] = weight; /*@0*/
    matrix[v][u] = weight; /*@1*/
}`, `
public final class AdjacencyMatrix {
    static void addUndirectedEdge(int[][] matrix, int u, int v, int weight) {
        matrix[u][v] = weight; /*@0*/
        matrix[v][u] = weight; /*@1*/
    }
}`, `
def add_undirected_edge(matrix: list[list[int]], u: int, v: int, weight: int) -> None:
    matrix[u][v] = weight  # @0
    matrix[v][u] = weight  # @1`);
    return pack(`
#include <utility>
#include <vector>
using Edge=std::pair<int,int>;
void addUndirectedEdge(std::vector<std::vector<Edge>>& adj,int u,int v,int w){
    adj[u].push_back({v,w}); /*@0*/
    adj[v].push_back({u,w}); /*@1*/
}`, `
import java.util.List;
public final class AdjacencyList {
    record Edge(int to,int weight) {}
    static void addUndirectedEdge(List<Edge>[] adj,int u,int v,int w){
        adj[u].add(new Edge(v,w)); /*@0*/
        adj[v].add(new Edge(u,w)); /*@1*/
    }
}`, `
def add_undirected_edge(adj: list[list[tuple[int,int]]], u: int, v: int, w: int) -> None:
    adj[u].append((v, w))  # @0
    adj[v].append((u, w))  # @1`);
  }

  function traversalCode(kind) {
    if (kind === 'dfs') return pack(`
#include <vector>
void dfs(int u,const std::vector<std::vector<int>>& adj,std::vector<bool>& visited){ /*@0*/
    visited[u]=true; /*@1*/
    for(int v:adj[u]) /*@2*/
        if(!visited[v]) dfs(v,adj,visited); /*@3*/
} /*@4*/`, `
import java.util.List;
public final class Dfs {
    static void dfs(int u,List<Integer>[] adj,boolean[] visited){ /*@0*/
        visited[u]=true; /*@1*/
        for(int v:adj[u]) /*@2*/
            if(!visited[v]) dfs(v,adj,visited); /*@3*/
    } /*@4*/
}`, `
def dfs(u: int, adj: list[list[int]], visited: list[bool]) -> None:  # @0
    visited[u] = True  # @1
    for v in adj[u]:  # @2
        if not visited[v]:
            dfs(v, adj, visited)  # @3
    # function end  @4`);
    return pack(`
#include <queue>
#include <vector>
void bfs(int start,const std::vector<std::vector<int>>& adj){
    std::vector<bool> visited(adj.size()); std::queue<int> q; q.push(start); visited[start]=true; /*@0*/
    while(!q.empty()){ /*@1*/
        int u=q.front(); q.pop(); /*@2*/
        for(int v:adj[u]) if(!visited[v]){visited[v]=true;q.push(v);} /*@3*/
    } /*@4*/
}`, `
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
public final class Bfs {
    static void bfs(int start,List<Integer>[] adj){
        boolean[] visited=new boolean[adj.length]; Queue<Integer> q=new ArrayDeque<>(); q.offer(start); visited[start]=true; /*@0*/
        while(!q.isEmpty()){ /*@1*/
            int u=q.poll(); /*@2*/
            for(int v:adj[u]) if(!visited[v]){visited[v]=true;q.offer(v);} /*@3*/
        } /*@4*/
    }
}`, `
from collections import deque

def bfs(start: int, adj: list[list[int]]) -> None:
    visited = [False] * len(adj); queue = deque([start]); visited[start] = True  # @0
    while queue:  # @1
        u = queue.popleft()  # @2
        for v in adj[u]:
            if not visited[v]: visited[v] = True; queue.append(v)  # @3
    # loop end  @4`);
  }

  function graphAlgorithmCode(kind) {
    if (kind === 'prim') return pack(`
#include <queue>
#include <tuple>
#include <vector>
std::vector<std::tuple<int,int,int>> prim(int start,const std::vector<std::vector<std::pair<int,int>>>& adj){
    std::vector<bool> selected(adj.size()); selected[start]=true; /*@0*/
    std::vector<std::tuple<int,int,int>> tree; /*@1*/
    std::priority_queue<std::tuple<int,int,int>,std::vector<std::tuple<int,int,int>>,std::greater<>> pq;
    for(auto [v,w]:adj[start]) pq.push({w,start,v});
    while(tree.size()+1<adj.size()){ /*@1*/
        auto [w,u,v]=pq.top();pq.pop(); if(selected[v])continue; /*@2*/
        selected[v]=true;tree.push_back({u,v,w}); /*@3*/
        for(auto [to,cost]:adj[v])if(!selected[to])pq.push({cost,v,to});
    } /*@4*/
    return tree;
}`, `
import java.util.*;
public final class Prim {
    record Edge(int weight,int from,int to) {}
    static List<Edge> run(int start,List<Edge>[] adj){
        boolean[] selected=new boolean[adj.length]; selected[start]=true; /*@0*/
        List<Edge> tree=new ArrayList<>(); PriorityQueue<Edge> pq=new PriorityQueue<>(Comparator.comparingInt(Edge::weight)); /*@1*/
        pq.addAll(adj[start]);
        while(tree.size()+1<adj.length){ /*@1*/
            Edge e=pq.poll(); if(selected[e.to()])continue; /*@2*/
            selected[e.to()]=true; tree.add(e); /*@3*/
            for(Edge next:adj[e.to()])if(!selected[next.to()])pq.offer(next);
        } /*@4*/
        return tree;
    }
}`, `
import heapq

def prim(start: int, adj: list[list[tuple[int,int]]]) -> list[tuple[int,int,int]]:
    selected = [False] * len(adj); selected[start] = True  # @0
    tree: list[tuple[int,int,int]] = []
    heap = [(w, start, v) for v, w in adj[start]]; heapq.heapify(heap)  # @1
    while len(tree) + 1 < len(adj):  # @1
        w, u, v = heapq.heappop(heap)
        if selected[v]: continue  # @2
        selected[v] = True; tree.append((u, v, w))  # @3
        for to, cost in adj[v]:
            if not selected[to]: heapq.heappush(heap, (cost, v, to))
    # loop end  @4
    return tree`);

    if (kind === 'kruskal') return pack(`
#include <algorithm>
#include <tuple>
#include <vector>
std::vector<std::tuple<int,int,int>> kruskal(int n,std::vector<std::tuple<int,int,int>> edges){
    std::sort(edges.begin(),edges.end()); /*@0*/
    std::vector<int> parent(n); for(int i=0;i<n;++i)parent[i]=i;
    auto find=[&](auto&& self,int x)->int{return parent[x]==x?x:parent[x]=self(self,parent[x]);};
    std::vector<std::tuple<int,int,int>> tree;
    for(auto [w,u,v]:edges){ /*@1*/
        int a=find(find,u),b=find(find,v); if(a!=b){ /*@2*/
            parent[a]=b;tree.push_back({w,u,v}); /*@3*/
        } /*@4*/
    } /*@5*/
    return tree;
}`, `
import java.util.*;
public final class Kruskal {
    record Edge(int weight,int u,int v) {}
    static List<Edge> run(int n,List<Edge> edges){
        edges.sort(Comparator.comparingInt(Edge::weight)); /*@0*/
        int[] parent=new int[n]; for(int i=0;i<n;i++)parent[i]=i;
        List<Edge> tree=new ArrayList<>();
        for(Edge e:edges){ /*@1*/
            int a=find(parent,e.u()),b=find(parent,e.v()); if(a!=b){ /*@2*/
                parent[a]=b; tree.add(e); /*@3*/
            } /*@4*/
        } /*@5*/
        return tree;
    }
    static int find(int[] p,int x){return p[x]==x?x:(p[x]=find(p,p[x]));}
}`, `
def kruskal(n: int, edges: list[tuple[int,int,int]]) -> list[tuple[int,int,int]]:
    edges.sort()  # @0
    parent = list(range(n))
    def find(x: int) -> int:
        if parent[x] != x: parent[x] = find(parent[x])
        return parent[x]
    tree = []
    for w, u, v in edges:  # @1
        a, b = find(u), find(v)
        if a != b:  # @2
            parent[a] = b; tree.append((w, u, v))  # @3
        # if end  @4
    # loop end  @5
    return tree`);

    if (kind === 'floyd') return pack(`
#include <algorithm>
#include <vector>
void floyd(std::vector<std::vector<int>>& dist){
    int n=dist.size();
    for(int k=0;k<n;++k) /*@0*/
        for(int i=0;i<n;++i) /*@1*/
            for(int j=0;j<n;++j) /*@2*/
                dist[i][j]=std::min(dist[i][j],dist[i][k]+dist[k][j]); /*@3*/
}`, `
public final class Floyd {
    static void run(int[][] dist){
        int n=dist.length;
        for(int k=0;k<n;k++) /*@0*/
            for(int i=0;i<n;i++) /*@1*/
                for(int j=0;j<n;j++) /*@2*/
                    dist[i][j]=Math.min(dist[i][j],dist[i][k]+dist[k][j]); /*@3*/
    }
}`, `
def floyd(dist: list[list[int]]) -> None:
    n = len(dist)
    for k in range(n):  # @0
        for i in range(n):  # @1
            for j in range(n):  # @2
                dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])  # @3`);

    if (kind === 'bellman') return pack(`
#include <limits>
#include <tuple>
#include <vector>
std::vector<int> bellmanFord(int n,int start,const std::vector<std::tuple<int,int,int>>& edges){
    std::vector<int> dist(n,std::numeric_limits<int>::max()/4);dist[start]=0; /*@0*/
    for(int round=1;round<n;++round) /*@1*/
        for(auto [u,v,w]:edges) /*@2*/
            if(dist[u]+w<dist[v])dist[v]=dist[u]+w; /*@3*/
    for(auto [u,v,w]:edges)if(dist[u]+w<dist[v])throw "negative cycle"; /*@4*/
    return dist;
}`, `
import java.util.*;
public final class BellmanFord {
    record Edge(int u,int v,int w) {}
    static int[] run(int n,int start,List<Edge> edges){
        int[] dist=new int[n];Arrays.fill(dist,Integer.MAX_VALUE/4);dist[start]=0; /*@0*/
        for(int round=1;round<n;round++) /*@1*/
            for(Edge e:edges) /*@2*/
                if(dist[e.u()]+e.w()<dist[e.v()])dist[e.v()]=dist[e.u()]+e.w(); /*@3*/
        for(Edge e:edges)if(dist[e.u()]+e.w()<dist[e.v()])throw new IllegalStateException("negative cycle"); /*@4*/
        return dist;
    }
}`, `
def bellman_ford(n: int, start: int, edges: list[tuple[int,int,int]]) -> list[float]:
    dist = [float("inf")] * n; dist[start] = 0  # @0
    for _ in range(n - 1):  # @1
        for u, v, w in edges:  # @2
            if dist[u] + w < dist[v]: dist[v] = dist[u] + w  # @3
    if any(dist[u] + w < dist[v] for u, v, w in edges): raise ValueError("negative cycle")  # @4
    return dist`);

    if (kind === 'topological') return pack(`
#include <queue>
#include <vector>
std::vector<int> topo(const std::vector<std::vector<int>>& adj){
    std::vector<int> indegree(adj.size()); /*@0*/
    for(int u=0;u<(int)adj.size();++u)for(int v:adj[u])++indegree[v];
    std::queue<int> q;for(int i=0;i<(int)adj.size();++i)if(indegree[i]==0)q.push(i); /*@1*/
    std::vector<int> order;
    while(!q.empty()){ /*@2*/
        int u=q.front();q.pop();order.push_back(u); /*@3*/
        for(int v:adj[u])if(--indegree[v]==0)q.push(v); /*@4*/
    } /*@5*/
    return order;
}`, `
import java.util.*;
public final class Topological {
    static List<Integer> sort(List<Integer>[] adj){
        int[] indegree=new int[adj.length]; /*@0*/
        for(List<Integer> list:adj)for(int v:list)indegree[v]++;
        Queue<Integer> q=new ArrayDeque<>();for(int i=0;i<adj.length;i++)if(indegree[i]==0)q.offer(i); /*@1*/
        List<Integer> order=new ArrayList<>();
        while(!q.isEmpty()){ /*@2*/
            int u=q.poll();order.add(u); /*@3*/
            for(int v:adj[u])if(--indegree[v]==0)q.offer(v); /*@4*/
        } /*@5*/
        return order;
    }
}`, `
from collections import deque

def topological(adj: list[list[int]]) -> list[int]:
    indegree = [0] * len(adj)  # @0
    for edges in adj:
        for v in edges: indegree[v] += 1
    queue = deque(i for i, d in enumerate(indegree) if d == 0)  # @1
    order = []
    while queue:  # @2
        u = queue.popleft(); order.append(u)  # @3
        for v in adj[u]:
            indegree[v] -= 1
            if indegree[v] == 0: queue.append(v)  # @4
    # loop end  @5
    return order`);

    if (kind === 'critical-path') return pack(`
#include <algorithm>
#include <tuple>
#include <vector>
void criticalPath(const std::vector<int>& order,const std::vector<std::vector<std::pair<int,int>>>& adj){
    std::vector<int> ve(adj.size()),vl(adj.size(),0); /*@0*/
    for(int u:order)for(auto [v,w]:adj[u])ve[v]=std::max(ve[v],ve[u]+w); /*@1*/
    std::fill(vl.begin(),vl.end(),ve[order.back()]);
    for(auto it=order.rbegin();it!=order.rend();++it)for(auto [v,w]:adj[*it])vl[*it]=std::min(vl[*it],vl[v]-w); /*@2*/
    for(int u:order)for(auto [v,w]:adj[u])if(ve[u]==vl[v]-w)volatile bool critical=true; /*@3*/
}`, `
import java.util.*;
public final class CriticalPath {
    record Edge(int to,int weight) {}
    static void run(List<Integer> order,List<Edge>[] adj){
        int[] ve=new int[adj.length],vl=new int[adj.length]; /*@0*/
        for(int u:order)for(Edge e:adj[u])ve[e.to()]=Math.max(ve[e.to()],ve[u]+e.weight()); /*@1*/
        Arrays.fill(vl,ve[order.get(order.size()-1)]);
        ListIterator<Integer> it=order.listIterator(order.size());while(it.hasPrevious()){int u=it.previous();for(Edge e:adj[u])vl[u]=Math.min(vl[u],vl[e.to()]-e.weight());} /*@2*/
        for(int u:order)for(Edge e:adj[u])if(ve[u]==vl[e.to()]-e.weight())System.out.println(u+"->"+e.to()); /*@3*/
    }
}`, `
def critical_path(order: list[int], adj: list[list[tuple[int,int]]]) -> list[tuple[int,int]]:
    ve = [0] * len(adj); vl = [0] * len(adj)  # @0
    for u in order:
        for v, w in adj[u]: ve[v] = max(ve[v], ve[u] + w)  # @1
    vl[:] = [ve[order[-1]]] * len(adj)
    for u in reversed(order):
        for v, w in adj[u]: vl[u] = min(vl[u], vl[v] - w)  # @2
    return [(u, v) for u in order for v, w in adj[u] if ve[u] == vl[v] - w]  # @3`);

    return pack(`
#include <limits>
#include <queue>
#include <utility>
#include <vector>
std::vector<int> dijkstra(int start,const std::vector<std::vector<std::pair<int,int>>>& adj){
    std::vector<int> dist(adj.size(),std::numeric_limits<int>::max());dist[start]=0; /*@0*/
    using State=std::pair<int,int>;std::priority_queue<State,std::vector<State>,std::greater<>> pq;pq.push({0,start});
    while(!pq.empty()){ /*@1*/
        auto [du,u]=pq.top();pq.pop();if(du!=dist[u])continue; /*@2*/
        for(auto [v,w]:adj[u])if(du+w<dist[v]){dist[v]=du+w;pq.push({dist[v],v});} /*@3*/
    } /*@4*/
    return dist;
}`, `
import java.util.*;
public final class Dijkstra {
    record Edge(int to,int weight) {} record State(int distance,int vertex) {}
    static int[] run(int start,List<Edge>[] adj){
        int[] dist=new int[adj.length];Arrays.fill(dist,Integer.MAX_VALUE);dist[start]=0; /*@0*/
        PriorityQueue<State> pq=new PriorityQueue<>(Comparator.comparingInt(State::distance));pq.offer(new State(0,start));
        while(!pq.isEmpty()){ /*@1*/
            State s=pq.poll();if(s.distance()!=dist[s.vertex()])continue; /*@2*/
            for(Edge e:adj[s.vertex()])if(s.distance()+e.weight()<dist[e.to()]){dist[e.to()]=s.distance()+e.weight();pq.offer(new State(dist[e.to()],e.to()));} /*@3*/
        } /*@4*/
        return dist;
    }
}`, `
import heapq

def dijkstra(start: int, adj: list[list[tuple[int,int]]]) -> list[float]:
    dist = [float("inf")] * len(adj); dist[start] = 0  # @0
    heap = [(0, start)]
    while heap:  # @1
        du, u = heapq.heappop(heap)
        if du != dist[u]: continue  # @2
        for v, w in adj[u]:
            if du + w < dist[v]: dist[v] = du + w; heapq.heappush(heap, (dist[v], v))  # @3
    # loop end  @4
    return dist`);
  }

  function searchCode(kind) {
    if (kind === 'binary-search') return pack(`
#include <vector>
int binarySearch(const std::vector<int>& a,int target){
    int left=0,right=(int)a.size()-1; /*@0*/
    while(left<=right){ /*@1*/
        int mid=left+(right-left)/2; /*@2*/
        if(a[mid]==target)return mid; /*@3*/
        if(a[mid]<target)left=mid+1; /*@4*/
        else right=mid-1; /*@5*/
    }return -1; /*@6*/
}`, `
public final class BinarySearch {
    static int search(int[] a,int target){
        int left=0,right=a.length-1; /*@0*/
        while(left<=right){ /*@1*/
            int mid=left+(right-left)/2; /*@2*/
            if(a[mid]==target)return mid; /*@3*/
            if(a[mid]<target)left=mid+1; /*@4*/
            else right=mid-1; /*@5*/
        }return -1; /*@6*/
    }
}`, `
def binary_search(a: list[int], target: int) -> int:
    left, right = 0, len(a) - 1  # @0
    while left <= right:  # @1
        mid = left + (right - left) // 2  # @2
        if a[mid] == target: return mid  # @3
        if a[mid] < target: left = mid + 1  # @4
        else: right = mid - 1  # @5
    return -1  # @6`);
    const ordered = kind === 'ordered-linear-search';
    return pack(`
#include <vector>
int linearSearch(const std::vector<int>& a,int target){
    for(int i=0;i<(int)a.size();++i){ /*@0*/
        if(a[i]==target)return i; /*@1*/
        ${ordered ? 'if(a[i]>target)break;' : '// 无序表必须继续扫描。'} /*@2*/
    } /*@3*/
    return -1; /*@4*/
}`, `
public final class LinearSearch {
    static int search(int[] a,int target){
        for(int i=0;i<a.length;i++){ /*@0*/
            if(a[i]==target)return i; /*@1*/
            ${ordered ? 'if(a[i]>target)break;' : '// 无序表必须继续扫描。'} /*@2*/
        } /*@3*/
        return -1; /*@4*/
    }
}`, `
def linear_search(a: list[int], target: int) -> int:
    for i, value in enumerate(a):  # @0
        if value == target: return i  # @1
        ${ordered ? 'if value > target: break' : '# 无序表必须继续扫描。'}  # @2
    # loop end  @3
    return -1  # @4`);
  }

  function hashCode(chaining) {
    if (chaining) return pack(`
#include <list>
#include <vector>
void insert(std::vector<std::list<int>>& table,int key){
    std::size_t index=key%table.size(); /*@0*/
    table[index].push_back(key); /*@1*/
}`, `
import java.util.List;
public final class ChainedHash {
    static void insert(List<Integer>[] table,int key){
        int index=Math.floorMod(key,table.length); /*@0*/
        table[index].add(key); /*@1*/
    }
}`, `
def insert(table: list[list[int]], key: int) -> None:
    index = key % len(table)  # @0
    table[index].append(key)  # @1`);
    return pack(`
#include <optional>
#include <vector>
void insert(std::vector<std::optional<int>>& table,int key){
    std::size_t index=key%table.size(); /*@0*/
    while(table[index].has_value())index=(index+1)%table.size(); /*@1*/
    table[index]=key; /*@2*/
}`, `
public final class OpenHash {
    static void insert(Integer[] table,int key){
        int index=Math.floorMod(key,table.length); /*@0*/
        while(table[index]!=null)index=(index+1)%table.length; /*@1*/
        table[index]=key; /*@2*/
    }
}`, `
def insert(table: list[int | None], key: int) -> None:
    index = key % len(table)  # @0
    while table[index] is not None: index = (index + 1) % len(table)  # @1
    table[index] = key  # @2`);
  }

  function sortCode(kind) {
    const snippets = {
      'bubble-sort': {
        cpp:`void sort(std::vector<int>& a){\n    for(int end=a.size()-1;end>0;--end) /*@0*/\n        for(int i=0;i<end;++i) /*@1*/\n            if(a[i]>a[i+1])std::swap(a[i],a[i+1]); /*@2*/\n}`,
        java:`static void sort(int[] a){\n    for(int end=a.length-1;end>0;end--) /*@0*/\n        for(int i=0;i<end;i++) /*@1*/\n            if(a[i]>a[i+1]){int t=a[i];a[i]=a[i+1];a[i+1]=t;} /*@2*/\n}`,
        python:`def sort(a: list[int]) -> None:\n    for end in range(len(a)-1,0,-1):  # @0\n        for i in range(end):  # @1\n            if a[i] > a[i+1]: a[i], a[i+1] = a[i+1], a[i]  # @2`
      },
      'insertion-sort': {
        cpp:`void sort(std::vector<int>& a){\n    for(int i=1;i<(int)a.size();++i){ /*@0*/\n        int key=a[i],j=i-1; /*@1*/\n        while(j>=0&&a[j]>key){a[j+1]=a[j];--j;} /*@2*/\n        a[j+1]=key; /*@3*/\n    } /*@4*/\n}`,
        java:`static void sort(int[] a){\n    for(int i=1;i<a.length;i++){ /*@0*/\n        int key=a[i],j=i-1; /*@1*/\n        while(j>=0&&a[j]>key){a[j+1]=a[j];j--;} /*@2*/\n        a[j+1]=key; /*@3*/\n    } /*@4*/\n}`,
        python:`def sort(a: list[int]) -> None:\n    for i in range(1, len(a)):  # @0\n        key, j = a[i], i - 1  # @1\n        while j >= 0 and a[j] > key: a[j+1] = a[j]; j -= 1  # @2\n        a[j+1] = key  # @3\n    # loop end  @4`
      },
      'binary-insertion-sort': {
        cpp:`void sort(std::vector<int>& a){\n    for(int i=1;i<(int)a.size();++i){ /*@0*/\n        int key=a[i],l=0,r=i;while(l<r){int m=(l+r)/2;if(a[m]<=key)l=m+1;else r=m;} /*@1*/\n        for(int j=i;j>l;--j)a[j]=a[j-1]; /*@2*/\n        a[l]=key; /*@3*/\n    } /*@4*/\n}`,
        java:`static void sort(int[] a){\n    for(int i=1;i<a.length;i++){ /*@0*/\n        int key=a[i],l=0,r=i;while(l<r){int m=(l+r)/2;if(a[m]<=key)l=m+1;else r=m;} /*@1*/\n        for(int j=i;j>l;j--)a[j]=a[j-1]; /*@2*/\n        a[l]=key; /*@3*/\n    } /*@4*/\n}`,
        python:`def sort(a: list[int]) -> None:\n    for i in range(1, len(a)):  # @0\n        key, left, right = a[i], 0, i\n        while left < right:\n            mid = (left + right) // 2; left, right = (mid+1,right) if a[mid] <= key else (left,mid)  # @1\n        for j in range(i, left, -1): a[j] = a[j-1]  # @2\n        a[left] = key  # @3\n    # loop end  @4`
      },
      'shell-sort': {
        cpp:`void sort(std::vector<int>& a){\n    for(int gap=a.size()/2;gap>0;gap/=2) /*@0*/\n        for(int i=gap;i<(int)a.size();++i){ /*@1*/\n            int x=a[i],j=i;while(j>=gap&&a[j-gap]>x){a[j]=a[j-gap];j-=gap;}a[j]=x; /*@2*/\n        }\n}`,
        java:`static void sort(int[] a){\n    for(int gap=a.length/2;gap>0;gap/=2) /*@0*/\n        for(int i=gap;i<a.length;i++){ /*@1*/\n            int x=a[i],j=i;while(j>=gap&&a[j-gap]>x){a[j]=a[j-gap];j-=gap;}a[j]=x; /*@2*/\n        }\n}`,
        python:`def sort(a: list[int]) -> None:\n    gap = len(a) // 2\n    while gap > 0:  # @0\n        for i in range(gap, len(a)):  # @1\n            x, j = a[i], i\n            while j >= gap and a[j-gap] > x: a[j] = a[j-gap]; j -= gap\n            a[j] = x  # @2\n        gap //= 2`
      },
      'selection-sort': {
        cpp:`void sort(std::vector<int>& a){\n    for(int i=0;i+1<(int)a.size();++i){ /*@0*/\n        int min=i; /*@1*/\n        for(int j=i+1;j<(int)a.size();++j)if(a[j]<a[min])min=j; /*@2*/\n        std::swap(a[i],a[min]); /*@3*/\n    } /*@4*/\n}`,
        java:`static void sort(int[] a){\n    for(int i=0;i+1<a.length;i++){ /*@0*/\n        int min=i; /*@1*/\n        for(int j=i+1;j<a.length;j++)if(a[j]<a[min])min=j; /*@2*/\n        int t=a[i];a[i]=a[min];a[min]=t; /*@3*/\n    } /*@4*/\n}`,
        python:`def sort(a: list[int]) -> None:\n    for i in range(len(a)-1):  # @0\n        min_i = i  # @1\n        for j in range(i+1, len(a)):\n            if a[j] < a[min_i]: min_i = j  # @2\n        a[i], a[min_i] = a[min_i], a[i]  # @3\n    # loop end  @4`
      },
      'quick-sort': {
        cpp:`void quick(std::vector<int>& a,int left,int right){ /*@0*/\n    if(left>=right)return;int pivot=a[right],i=left;for(int j=left;j<right;++j)if(a[j]<pivot)std::swap(a[i++],a[j]);std::swap(a[i],a[right]); /*@1*/\n    quick(a,left,i-1); /*@2*/\n    quick(a,i+1,right); /*@3*/\n} /*@4*/`,
        java:`static void quick(int[] a,int left,int right){ /*@0*/\n    if(left>=right)return;int pivot=a[right],i=left;for(int j=left;j<right;j++)if(a[j]<pivot){int t=a[i];a[i++]=a[j];a[j]=t;}int t=a[i];a[i]=a[right];a[right]=t; /*@1*/\n    quick(a,left,i-1); /*@2*/\n    quick(a,i+1,right); /*@3*/\n} /*@4*/`,
        python:`def quick(a: list[int], left: int, right: int) -> None:  # @0\n    if left >= right: return\n    pivot, i = a[right], left\n    for j in range(left, right):\n        if a[j] < pivot: a[i], a[j] = a[j], a[i]; i += 1\n    a[i], a[right] = a[right], a[i]  # @1\n    quick(a, left, i-1)  # @2\n    quick(a, i+1, right)  # @3\n    # function end  @4`
      },
      'merge-sort': {
        cpp:`void mergeSort(std::vector<int>& a,int left,int right){ /*@0*/\n    if(left>=right)return;int mid=(left+right)/2; /*@1*/\n    mergeSort(a,left,mid);mergeSort(a,mid+1,right); /*@2*/\n    std::inplace_merge(a.begin()+left,a.begin()+mid+1,a.begin()+right+1); /*@3*/\n} /*@4*/`,
        java:`static void mergeSort(int[] a,int left,int right){ /*@0*/\n    if(left>=right)return;int mid=(left+right)/2; /*@1*/\n    mergeSort(a,left,mid);mergeSort(a,mid+1,right); /*@2*/\n    merge(a,left,mid,right); /*@3*/\n} /*@4*/`,
        python:`def merge_sort(a: list[int], left: int, right: int) -> None:  # @0\n    if left >= right: return\n    mid = (left + right) // 2  # @1\n    merge_sort(a, left, mid); merge_sort(a, mid+1, right)  # @2\n    a[left:right+1] = sorted(a[left:right+1])  # @3\n    # function end  @4`
      },
      'heap-sort': {
        cpp:`void heapSort(std::vector<int>& a){\n    std::make_heap(a.begin(),a.end()); /*@0*/\n    for(auto end=a.end();end!=a.begin();--end){ /*@1*/\n        std::pop_heap(a.begin(),end); /*@2*/\n        std::make_heap(a.begin(),end-1); /*@3*/\n    } /*@4*/\n}`,
        java:`static void heapSort(int[] a){\n    for(int i=a.length/2-1;i>=0;i--)sift(a,i,a.length); /*@0*/\n    for(int end=a.length-1;end>0;end--){ /*@1*/\n        int t=a[0];a[0]=a[end];a[end]=t; /*@2*/\n        sift(a,0,end); /*@3*/\n    } /*@4*/\n}`,
        python:`def heap_sort(a: list[int]) -> None:\n    import heapq; heapq.heapify(a)  # @0\n    result = []\n    while a:  # @1\n        result.append(heapq.heappop(a))  # @2\n        # heapq automatically sifts down  @3\n    a[:] = result  # @4`
      },
      'radix-sort': {
        cpp:`void radix(std::vector<int>& a){\n    int maximum=*std::max_element(a.begin(),a.end());\n    for(int exp=1;maximum/exp>0;exp*=10) /*@0*/\n        countingByDigit(a,exp); /*@1*/\n}`,
        java:`static void radix(int[] a){\n    int maximum=java.util.Arrays.stream(a).max().orElse(0);\n    for(int exp=1;maximum/exp>0;exp*=10) /*@0*/\n        countingByDigit(a,exp); /*@1*/\n}`,
        python:`def radix(a: list[int]) -> None:\n    exp, maximum = 1, max(a, default=0)\n    while maximum // exp > 0:  # @0\n        counting_by_digit(a, exp)  # @1\n        exp *= 10`
      }
    };
    const s = snippets[kind] || snippets['bubble-sort'];
    return pack(`#include <algorithm>\n#include <vector>\n${s.cpp}`, `public final class SortDemo {\n${s.java.split('\n').map(x=>'    '+x).join('\n')}\n}`, s.python);
  }

  function fallbackCode(module, trace) {
    const pseudo = (trace.code || []).map((line, i) => `// ${line} /*@${i}*/`).join('\n');
    const py = (trace.code || []).map((line, i) => `    # ${line}  # @${i}`).join('\n');
    return pack(`#include <iostream>\nvoid run(){\n${pseudo}\n    std::cout << "${String(module.title).replace(/"/g,'')}";\n}`, `public final class Demo {\n    static void run() {\n${pseudo.split('\n').map(x=>'        '+x).join('\n')}\n        System.out.println("${String(module.title).replace(/"/g,'')}");\n    }\n}`, `def run() -> None:\n${py}\n    print(${JSON.stringify(module.title)})`);
  }

  window.getCodeBundle = function getCodeBundle(module, trace) {
    const id = module.demo;
    if (id === 'sequence') return sequenceCode();
    if (['linked','linked-head','circular-singly'].includes(id)) return linkedCode(false);
    if (['doubly','doubly-head','circular-doubly'].includes(id)) return linkedCode(true);
    if (id === 'static-list') return staticListCode();
    if (id === 'stack' || id === 'linked-stack') return stackCode();
    if (['queue','linked-queue','circular-queue'].includes(id)) return queueCode(false);
    if (id === 'deque') return queueCode(true);
    if (id === 'bracket') return bracketCode();
    if (id === 'expression') return expressionCode();
    if (['array-storage','symmetric','triangular','tridiagonal','sparse'].includes(id)) return matrixCode(id);
    if (id === 'naive-match') return stringCode(false);
    if (id === 'kmp') return stringCode(true);
    if (['binary-tree','level-order','threaded'].includes(id)) return treeCode(id);
    if (['bst','avl','red-black','b-tree','huffman'].includes(id)) return searchTreeCode(id);
    if (id === 'adj-matrix') return graphStorageCode(true);
    if (id === 'adj-list') return graphStorageCode(false);
    if (id === 'bfs' || id === 'dfs') return traversalCode(id);
    if (['prim','kruskal','dijkstra','floyd','bellman','topological','critical-path'].includes(id)) return graphAlgorithmCode(id);
    if (['linear-search','ordered-linear-search','binary-search'].includes(id)) return searchCode(id);
    if (id === 'hash-chain') return hashCode(true);
    if (id === 'hash-open') return hashCode(false);
    if (id.endsWith('-sort')) return sortCode(id);
    return fallbackCode(module, trace);
  };
  window.getOperationCode = function getOperationCode(module, action) {
    const id = module.id, type = module.type, demo = module.demo;
    // Special: insert for sequence/list/hash delegates to existing algorithm code
    if (action === 'insert') {
      if (id === 'sequence-list' || id === 'static-list') return sequenceCode();
      if (type === 'linked') return linkedCode(demo.includes('doubly'));
      if (type === 'hash' && demo.startsWith('hash')) return hashCode(demo === 'hash-chain');
    }
    // Dispatch by module type
    if (id === 'sequence-list' || id === 'static-list') return seqListOps(action);
    if (type === 'linked') return linkedOps(action, demo);
    if (type === 'stack') return stackOps(action);
    if (type === 'queue') return queueOps(action, id === 'deque');
    if (type === 'matrix') return matrixOps(action);
    if (type === 'tree' || type === 'btree' || id === 'level-order') return treeOps(action);
    if (type === 'graph') return graphOps(action);
    if (type === 'hash') return hashOps(action, demo);
    if (id.endsWith('-sort')) return sortOps(action);
    if (['linear-search','ordered-linear-search','binary-search'].includes(id)) return searchOps(action);
    // fallback: use searchOps generic
    return searchOps(action);
  };

  // ─── 顺序表操作 ───
  function seqListOps(action) {
    if (action === 'create') return pack(
`int* createArr(int* src, int n) {
    int cap = n < 10 ? 10 : n * 2;
    int* arr = new int[cap]; /*@0*/
    int length = 0;
    for (int i = 0; i < n; ++i)
        arr[i] = src[i]; /*@1*/
    length = n;
    return arr; /*@2*/
}`
,`int[] createArr(int[] src, int n) {
    int cap = n < 10 ? 10 : n * 2;
    int[] arr = new int[cap]; /*@0*/
    int length = 0;
    for (int i = 0; i < n; i++)
        arr[i] = src[i]; /*@1*/
    length = n;
    return arr; /*@2*/
}`
,`def create_arr(src: list[int]) -> list[int]:
    n = len(src)
    cap = n if n >= 10 else 10
    arr = [None] * (cap * 2 if n < 10 else cap)  # @0
    length = 0
    for i, v in enumerate(src):
        arr[i] = v  # @1
        length += 1  # @1
    return arr  # @2`);
    if (action === 'delete') return pack(
`bool removeAt(int* arr, int& len, int pos) {
    if (pos < 0 || pos >= len) return false; /*@0*/
    for (int i = pos; i < len - 1; ++i)
        arr[i] = arr[i + 1]; /*@1*/
    --len; /*@2*/
    return true;
}`
,`boolean removeAt(int[] arr, int pos) {
    if (pos < 0 || pos >= len) return false; /*@0*/
    for (int i = pos; i < len - 1; i++)
        arr[i] = arr[i + 1]; /*@1*/
    len--; /*@2*/
    return true;
}`
,`def remove_at(arr: list[int], pos: int) -> bool:
    if pos < 0 or pos >= len(arr):
        return False  # @0
    for i in range(pos, len(arr) - 1):
        arr[i] = arr[i + 1]  # @1
    arr.pop()  # @2
    return True  # @2`);
    if (action === 'access') return pack(
`int getAt(int* arr, int len, int pos) {
    if (pos < 0 || pos >= len)
        throw std::out_of_range(""); /*@0*/
    return arr[pos]; /*@1*/
}`
,`int getAt(int[] arr, int pos) {
    if (pos < 0 || pos >= arr.length)
        throw new IndexOutOfBoundsException(); /*@0*/
    return arr[pos]; /*@1*/
}`
,`def get_at(arr: list[int], pos: int) -> int:
    if pos < 0 or pos >= len(arr):
        raise IndexError  # @0
    return arr[pos]  # @1`);
    if (action === 'update') return pack(
`void setAt(int* arr, int len, int pos, int val) {
    if (pos < 0 || pos >= len)
        throw std::out_of_range(""); /*@0*/
    arr[pos] = val; /*@1*/
}`
,`void setAt(int[] arr, int pos, int val) {
    if (pos < 0 || pos >= arr.length)
        throw new IndexOutOfBoundsException(); /*@0*/
    arr[pos] = val; /*@1*/
}`
,`def set_at(arr: list[int], pos: int, val: int) -> None:
    if pos < 0 or pos >= len(arr):
        raise IndexError  # @0
    arr[pos] = val  # @1`);
    if (action === 'search') return pack(
`int search(int* arr, int len, int target) {
    for (int i = 0; i < len; ++i)
        if (arr[i] == target) return i; /*@1*/
    return -1; /*@2*/
}`
,`int search(int[] arr, int target) {
    for (int i = 0; i < arr.length; i++)
        if (arr[i] == target) return i; /*@1*/
    return -1; /*@2*/
}`
,`def search(arr: list[int], target: int) -> int:
    for i, v in enumerate(arr):
        if v == target: return i  # @1
    return -1  # @2`);
    if (action === 'traverse') return pack(
`void traverse(int* arr, int len) {
    for (int i = 0; i < len; ++i)
        visit(arr[i]); /*@0*/
}`
,`void traverse(int[] arr) {
    for (int v : arr)
        visit(v); /*@0*/
}`
,`def traverse(arr: list[int]) -> None:
    for v in arr:
        visit(v)  # @0`);
    return seqListOps('create');
  }

  // ─── 链表操作 ───
  function linkedOps(action, demo) {
    const doubly = demo.includes('doubly');
    const dbl = doubly ? 'prev' : '';
    if (action === 'create') return pack(
`Node* createList(int* a, int n) {
    Node* head = nullptr; /*@0*/
    Node* tail = nullptr;
    for (int i = 0; i < n; ++i) {
        Node* n = new Node{a[i], nullptr${doubly ? ', nullptr' : ''}}; /*@1*/
        if (!head) head = n; else tail->next = n;
        ${doubly ? 'if (tail) n->prev = tail;\n        ' : ''}tail = n;
    }
    return head; /*@2*/
}`
,`Node createList(int[] a, int n) {
    Node head = null; /*@0*/
    Node tail = null;
    for (int i = 0; i < n; i++) {
        Node n = new Node(a[i]); /*@1*/
        if (head == null) head = n; else tail.next = n;
        ${doubly ? 'n.prev = tail;\n        ' : ''}tail = n;
    }
    return head; /*@2*/
}`
,`def create_list(a: list[int]) -> Node:
    head = None  # @0
    tail = None
    for v in a:
        n = Node(v${doubly ? '' : ''})  # @1
        if head is None: head = n
        else: tail.next = n
        ${doubly ? '        n.prev = tail\n        ' : ''}tail = n
    return head  # @2`);
    if (action === 'delete') return pack(
`void deleteNode(Node*& head, int pos) {
    if (!head) return; /*@0*/
    Node* cur = head;
    if (pos == 0) { head = head->next; ${doubly ? 'if (head) head->prev = nullptr;' : ''} delete cur; return; } /*@1*/
    for (int i = 0; cur && i < pos - 1; ++i) cur = cur->next;
    if (cur && cur->next) {
        Node* t = cur->next; cur->next = t->next;
        ${doubly ? 'if (t->next) t->next->prev = cur;' : ''} delete t; /*@2*/
    }
}`
,`void deleteNode(Node head, int pos) {
    if (head == null) return; /*@0*/
    if (pos == 0) { head = head.next; return; } /*@1*/
    Node cur = head;
    for (int i = 0; cur != null && i < pos - 1; i++) cur = cur.next;
    if (cur != null && cur.next != null)
        cur.next = cur.next.next; /*@2*/
}`
,`def delete_node(head: Node, pos: int) -> Node:
    if head is None: return head  # @0
    if pos == 0: head = head.next; return head  # @1
    cur = head
    for _ in range(pos - 1):
        cur = cur.next
    if cur and cur.next:
        cur.next = cur.next.next  # @2
    return head`);
    if (action === 'reverse') return pack(
`void reverse(Node*& head) {
    Node* prev = nullptr; /*@0*/
    Node* cur = head;
    while (cur) {
        Node* nxt = cur->next;
        cur->next = prev; ${doubly ? 'cur->prev = nxt;' : ''} /*@1*/
        prev = cur; cur = nxt;
    }
    head = prev; /*@2*/
}`
,`Node reverse(Node head) {
    Node prev = null; /*@0*/
    Node cur = head;
    while (cur != null) {
        Node nxt = cur.next;
        cur.next = prev; /*@1*/
        prev = cur; cur = nxt;
    }
    return prev; /*@2*/
}`
,`def reverse(head: Node) -> Node:
    prev = None  # @0
    cur = head
    while cur:
        nxt = cur.next
        cur.next = prev  # @1
        prev, cur = cur, nxt
    return prev  # @2`);
    if (action === 'access') return pack(
`Node* access(Node* head, int idx) {
    Node* cur = head;
    for (int i = 0; cur && i < idx; ++i)
        cur = cur->next; /*@1*/
    return cur;
}`
,`Node access(Node head, int idx) {
    Node cur = head;
    for (int i = 0; cur != null && i < idx; i++)
        cur = cur.next; /*@1*/
    return cur;
}`
,`def access(head: Node, idx: int) -> Node:
    cur = head
    for _ in range(idx):
        if cur is None: break
        cur = cur.next  # @1
    return cur`);
    if (action === 'search') return pack(
`int search(Node* head, int target) {
    Node* cur = head; int idx = 0;
    while (cur) {
        if (cur->data == target) return idx; /*@1*/
        cur = cur->next; ++idx;
    }
    return -1; /*@2*/
}`
,`int search(Node head, int target) {
    Node cur = head; int idx = 0;
    while (cur != null) {
        if (cur.data == target) return idx; /*@1*/
        cur = cur.next; idx++;
    }
    return -1; /*@2*/
}`
,`def search(head: Node, target: int) -> int:
    cur, idx = head, 0
    while cur:
        if cur.data == target: return idx  # @1
        cur = cur.next; idx += 1
    return -1  # @2`);
    // traverse uses same access code but visits all
    if (action === 'traverse') return pack(
`void traverse(Node* head) {
    Node* cur = head;
    while (cur) {
        visit(cur->data); /*@1*/
        cur = cur->next;
    }
}`
,`void traverse(Node head) {
    Node cur = head;
    while (cur != null) {
        visit(cur.data); /*@1*/
        cur = cur.next;
    }
}`
,`def traverse(head: Node) -> None:
    cur = head
    while cur:
        visit(cur.data)  # @1
        cur = cur.next`);
    return linkedOps('create', demo);
  }

  // ─── 栈操作 ───
  function stackOps(action) {
    if (action === 'create') return pack(
`int* createStack(int cap) {
    int* s = new int[cap]; /*@0*/
    int top = -1;
    return s; /*@1*/
}`
,`int[] createStack(int cap) {
    int[] s = new int[cap]; /*@0*/
    top = -1;
    return s; /*@1*/
}`
,`def create_stack(cap: int) -> list:
    s = [None] * cap  # @0
    top = -1
    return s  # @1`);
    if (action === 'push') return pack(
`bool push(int* s, int cap, int& top, int val) {
    if (top >= cap - 1) return false; /*@0*/
    s[++top] = val; /*@1*/
    return true;
}`
,`boolean push(int val) {
    if (top >= cap - 1) return false; /*@0*/
    s[++top] = val; /*@1*/
    return true;
}`
,`def push(val: int) -> bool:
    global top
    if top >= cap - 1: return False  # @0
    top += 1; s[top] = val  # @1
    return True`);
    if (action === 'pop') return pack(
`int pop(int* s, int& top) {
    int val = s[top]; /*@0*/
    --top; /*@1*/
    return val;
}`
,`int pop() {
    int val = s[top]; /*@0*/
    top--; /*@1*/
    return val;
}`
,`def pop() -> int:
    global top
    val = s[top]  # @0
    top -= 1  # @1
    return val`);
    if (action === 'peek') return pack(
`int peek(int* s, int top) {
    return s[top]; /*@0*/
}`
,`int peek() {
    return s[top]; /*@0*/
}`
,`def peek() -> int:
    return s[top]  # @0`);
    if (action === 'clear') return pack(
`void clear(int& top) {
    while (top >= 0) { /*@0*/
        s[top] = 0; --top; /*@1*/
    }
}`
,`void clear() {
    while (top >= 0) { /*@0*/
        s[top] = 0; top--; /*@1*/
    }
}`
,`def clear() -> None:
    global top
    while top >= 0:  # @0
        s[top] = 0; top -= 1  # @1`);
    // traverse
    return pack(
`void traverse(int* s, int top) {
    for (int i = 0; i <= top; ++i)
        visit(s[i]); /*@1*/
}`
,`void traverse() {
    for (int i = 0; i <= top; i++)
        visit(s[i]); /*@1*/
}`
,`def traverse() -> None:
    for i in range(top + 1):
        visit(s[i])  # @1`);
  }

  // ─── 队列操作 ───
  function queueOps(action, isDeque) {
    if (action === 'create') return pack(
`int* createQueue(int cap) {
    int* q = new int[cap]; /*@0*/
    int front = 0, rear = 0;
    return q; /*@1*/
}`
,`int[] createQueue(int cap) {
    int[] q = new int[cap]; /*@0*/
    front = 0; rear = 0;
    return q; /*@1*/`
,`def create_queue(cap: int) -> list:
    q = [None] * cap  # @0
    front = rear = 0
    return q  # @1`);
    if (action === 'enqueue') return pack(
`bool enqueue(int* q, int cap, int& rear, int val) {
    if (rear >= cap) return false; /*@0*/
    q[rear++] = val; /*@1*/
    return true;
}`
,`boolean enqueue(int val) {
    if (rear >= cap) return false; /*@0*/
    q[rear++] = val; /*@1*/
    return true;
}`
,`def enqueue(val: int) -> bool:
    global rear
    if rear >= cap: return False  # @0
    q[rear] = val; rear += 1  # @1
    return True`);
    if (action === 'dequeue') return pack(
`int dequeue(int* q, int& front, int& rear) {
    int val = q[front]; /*@0*/
    ++front; /*@1*/
    return val;
}`
,`int dequeue() {
    int val = q[front]; /*@0*/
    front++; /*@1*/
    return val;
}`
,`def dequeue() -> int:
    global front
    val = q[front]  # @0
    front += 1  # @1
    return val`);
    if (action === 'front') return pack(
`int front(int* q, int front) {
    return q[front]; /*@0*/
}`
,`int front() {
    return q[front]; /*@0*/
}`
,`def front() -> int:
    return q[front]  # @0`);
    if (action === 'clear') return pack(
`void clearQueue(int cap, int& front, int& rear) {
    front = 0; rear = 0; /*@0*/
    while (front < cap) q[front++] = 0; /*@1*/
}`
,`void clearQueue() {
    front = 0; rear = 0; /*@0*/
    while (front < cap) q[front++] = 0; /*@1*/
}`
,`def clear_queue() -> None:
    global front, rear
    front = rear = 0  # @0
    while front < cap: q[front] = 0; front += 1  # @1`);
    if (action === 'push-front') return pack(
`void pushFront(int* q, int cap, int& front, int& rear, int val) {
    if (front == 0) return; /*@0*/
    q[--front] = val; /*@1*/
}`
,`void pushFront(int val) {
    if (front == 0) return; /*@0*/
    q[--front] = val; /*@1*/
}`
,`def push_front(val: int) -> None:
    global front
    if front == 0: return  # @0
    front -= 1; q[front] = val  # @1`);
    if (action === 'push-back') return queueOps('enqueue', false);
    if (action === 'pop-front') return pack(
`int popFront(int* q, int& front, int& rear) {
    int val = q[front]; /*@0*/
    ++front; /*@1*/
    return val;
}`
,`int popFront() {
    int val = q[front]; /*@0*/
    front++; /*@1*/
    return val;
}`
,`def pop_front() -> int:
    global front
    val = q[front]  # @0
    front += 1  # @1
    return val`);
    if (action === 'pop-back') return pack(
`int popBack(int* q, int& rear) {
    int val = q[--rear]; /*@0*/
    return val; /*@1*/
}`
,`int popBack() {
    int val = q[--rear]; /*@0*/
    return val; /*@1*/
}`
,`def pop_back() -> int:
    global rear
    val = q[rear - 1]; rear -= 1  # @0
    return val  # @1`);
    // access and traverse
    if (action === 'access') return pack(
`int access(int* q, int front, int idx) {
    return q[front + idx]; /*@0*/
}`
,`int access(int idx) {
    return q[front + idx]; /*@0*/`
,`def access(idx: int) -> int:
    return q[front + idx]  # @0`);
    // traverse
    return pack(
`void traverse(int* q, int front, int rear) {
    for (int i = front; i < rear; ++i)
        visit(q[i]); /*@1*/
}`
,`void traverse() {
    for (int i = front; i < rear; i++)
        visit(q[i]); /*@1*/
}`
,`def traverse() -> None:
    for i in range(front, rear):
        visit(q[i])  # @1`);
  }
  // ─── 矩阵操作 ───
  function matrixOps(action) {
    if (action === 'create') return pack(
`int** createMat(int n) {
    int** m = new int*[n]; /*@0*/
    for (int i = 0; i < n; ++i) m[i] = new int[n]{};
    return m; /*@1*/
}`
,`int[][] createMat(int n) {
    int[][] m = new int[n][n]; /*@0*/
    return m; /*@1*/
}`
,`def create_mat(n: int) -> list:
    m = [[0] * n for _ in range(n)]  # @0
    return m  # @1`);
    if (action === 'access') return pack(
`int access(int** m, int i, int j) {
    return m[i][j]; /*@1*/
}`
,`int access(int[][] m, int i, int j) {
    return m[i][j]; /*@1*/
}`
,`def access(m: list, i: int, j: int) -> int:
    return m[i][j]  # @1`);
    if (action === 'update') return pack(
`void update(int** m, int i, int j, int v) {
    m[i][j] = v; /*@1*/
}`
,`void update(int[][] m, int i, int j, int v) {
    m[i][j] = v; /*@1*/
}`
,`def update(m: list, i: int, j: int, v: int) -> None:
    m[i][j] = v  # @1`);
    if (action === 'compress') return pack(
`struct Triplet { int r, c, v; };
void compress(int** m, int n, Triplet* t, int& k) {
    k = 0;
    for (int i = 0; i < n; ++i)
        for (int j = 0; j < n; ++j)
            if (m[i][j] != 0) { t[k++] = {i, j, m[i][j]}; } /*@1*/
}`
,`class Triplet { int r, c, v; Triplet(int r, int c, int v) { this.r = r; this.c = c; this.v = v; } }
void compress(int[][] m, List<Triplet> t) {
    for (int i = 0; i < m.length; i++)
        for (int j = 0; j < m[0].length; j++)
            if (m[i][j] != 0) t.add(new Triplet(i, j, m[i][j])); /*@1*/
}`
,`def compress(m: list) -> list:
    t = []
    for i, row in enumerate(m):
        for j, v in enumerate(row):
            if v != 0: t.append((i, j, v))  # @1
    return t`);
    // traverse
    return pack(
`void traverse(int** m, int n) {
    for (int i = 0; i < n; ++i)
        for (int j = 0; j < n; ++j)
            visit(m[i][j]); /*@1*/
}`
,`void traverse(int[][] m) {
    for (int[] r : m)
        for (int v : r)
            visit(v); /*@1*/
}`
,`def traverse(m: list) -> None:
    for row in m:
        for v in row:
            visit(v)  # @1`);
  }

  // ─── 树操作 ───
  function treeOps(action) {
    if (action === 'create' || action === 'insert') return pack(
`Node* insert(Node* root, int key) {
    if (!root) return new Node{key}; /*@0*/
    if (key < root->val) root->left = insert(root->left, key); /*@1*/
    else root->right = insert(root->right, key);
    return root;
}`
,`Node insert(Node root, int key) {
    if (root == null) return new Node(key); /*@0*/
    if (key < root.val) root.left = insert(root.left, key); /*@1*/
    else root.right = insert(root.right, key);
    return root;
}`
,`def insert(root: Node, key: int) -> Node:
    if root is None: return Node(key)  # @0
    if key < root.val: root.left = insert(root.left, key)  # @1
    else: root.right = insert(root.right, key)
    return root`);
    if (action === 'delete') return pack(
`Node* delete(Node* root, int key) {
    if (!root) return nullptr; /*@0*/
    if (key < root->val) root->left = delete(root->left, key);
    else if (key > root->val) root->right = delete(root->right, key);
    else {
        Node* t = root->right;
        while (t && t->left) t = t->left; /*@1*/
        root->val = t->val;
        root->right = delete(root->right, t->val);
    }
    return root;
}`
,`Node delete(Node root, int key) {
    if (root == null) return null; /*@0*/
    if (key < root.val) root.left = delete(root.left, key);
    else if (key > root.val) root.right = delete(root.right, key);
    else {
        Node t = root.right;
        while (t != null && t.left != null) t = t.left; /*@1*/
        root.val = t.val;
        root.right = delete(root.right, t.val);
    }
    return root;
}`
,`def delete(root: Node, key: int) -> Node:
    if root is None: return None  # @0
    if key < root.val: root.left = delete(root.left, key)
    elif key > root.val: root.right = delete(root.right, key)
    else:
        t = root.right
        while t and t.left: t = t.left  # @1
        root.val = t.val
        root.right = delete(root.right, t.val)
    return root`);
    // Search + all traversals: single line showing visit
    if (action === 'search') return pack(
`Node* search(Node* root, int key) {
    while (root) {
        if (root->val == key) return root; /*@1*/
        root = key < root->val ? root->left : root->right;
    }
    return nullptr;
}`
,`Node search(Node root, int key) {
    while (root != null) {
        if (root.val == key) return root; /*@1*/
        root = key < root.val ? root.left : root.right;
    }
    return null;
}`
,`def search(root: Node, key: int) -> Node:
    while root:
        if root.val == key: return root  # @1
        root = root.left if key < root.val else root.right
    return None`);
    if (action === 'preorder') return pack(
`void preorder(Node* root) {
    if (!root) return;
    visit(root->val); /*@1*/
    preorder(root->left);
    preorder(root->right);
}`
,`void preorder(Node root) {
    if (root == null) return;
    visit(root.val); /*@1*/
    preorder(root.left);
    preorder(root.right);
}`
,`def preorder(root: Node) -> None:
    if root is None: return
    visit(root.val)  # @1
    preorder(root.left)
    preorder(root.right)`);
    if (action === 'inorder') return pack(
`void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    visit(root->val); /*@1*/
    inorder(root->right);
}`
,`void inorder(Node root) {
    if (root == null) return;
    inorder(root.left);
    visit(root.val); /*@1*/
    inorder(root.right);
}`
,`def inorder(root: Node) -> None:
    if root is None: return
    inorder(root.left)
    visit(root.val)  # @1
    inorder(root.right)`);
    if (action === 'postorder') return pack(
`void postorder(Node* root) {
    if (!root) return;
    postorder(root->left);
    postorder(root->right);
    visit(root->val); /*@1*/
}`
,`void postorder(Node root) {
    if (root == null) return;
    postorder(root.left);
    postorder(root.right);
    visit(root.val); /*@1*/
}`
,`def postorder(root: Node) -> None:
    if root is None: return
    postorder(root.left)
    postorder(root.right)
    visit(root.val)  # @1`);
    // level order
    if (action === 'level') return pack(
`void levelOrder(Node* root) {
    std::queue<Node*> q;
    q.push(root);
    while (!q.empty()) {
        Node* cur = q.front(); q.pop(); /*@1*/
        visit(cur->val);
        if (cur->left) q.push(cur->left);
        if (cur->right) q.push(cur->right);
    }
}`
,`void levelOrder(Node root) {
    Queue<Node> q = new LinkedList<>();
    q.offer(root);
    while (!q.isEmpty()) {
        Node cur = q.poll(); /*@1*/
        visit(cur.val);
        if (cur.left != null) q.offer(cur.left);
        if (cur.right != null) q.offer(cur.right);
    }
}`
,`def level_order(root: Node) -> None:
    q = [root]
    while q:
        cur = q.pop(0)  # @1
        visit(cur.val)
        if cur.left: q.append(cur.left)
        if cur.right: q.append(cur.right)`);
    return treeOps('preorder');
  }

  // ─── 图操作 ───
  function graphOps(action) {
    if (action === 'create') return pack(
`vector<vector<int>> createGraph(int n) {
    vector<vector<int>> g(n); /*@0*/
    g.push_back({}); /*@1*/
    g[0].push_back(1); /*@2*/
    return g;
}`
,`List<List<Integer>> createGraph(int n) {
    List<List<Integer>> g = new ArrayList<>(n); /*@0*/
    g.add(new ArrayList<>()); /*@1*/
    g.get(0).add(1); /*@2*/
    return g;
}`
,`def create_graph(n: int) -> list:
    g = [[] for _ in range(n)]  # @0
    g.append([])  # @1
    g[0].append(1)  # @2
    return g`);
    if (action === 'add-vertex') return pack(
`void addVertex(vector<vector<int>>& g) {
    g.push_back({}); /*@1*/
}`
,`void addVertex(List<List<Integer>> g) {
    g.add(new ArrayList<>()); /*@1*/`
,`def add_vertex(g: list) -> None:
    g.append([])  # @1`);
    if (action === 'add-edge') return pack(
`void addEdge(vector<vector<int>>& g, int u, int v) {
    g[u].push_back(v); /*@1*/
    g[v].push_back(u);
}`
,`void addEdge(List<List<Integer>> g, int u, int v) {
    g.get(u).add(v); /*@1*/
    g.get(v).add(u);
}`
,`def add_edge(g: list, u: int, v: int) -> None:
    g[u].append(v)  # @1
    g[v].append(u)`);
    if (action === 'delete-edge') return pack(
`void deleteEdge(vector<vector<int>>& g, int u, int v) {
    auto& nu = g[u], nv = g[v]; /*@0*/
    nu.erase(find(nu.begin(), nu.end(), v)); /*@1*/
    nv.erase(find(nv.begin(), nv.end(), u));
}`
,`void deleteEdge(List<List<Integer>> g, int u, int v) {
    g.get(u).remove(Integer.valueOf(v)); /*@0*/
    g.get(v).remove(Integer.valueOf(u)); /*@1*/`
,`def delete_edge(g: list, u: int, v: int) -> None:
    g[u].remove(v)  # @0
    g[v].remove(u)  # @1`);
    if (action === 'bfs-op') return pack(
`void bfs(vector<vector<int>>& g, int s) {
    queue<int> q; q.push(s); bool* vis = new bool[g.size()]{};
    vis[s] = true;
    while (!q.empty()) {
        int u = q.front(); q.pop(); visit(u); /*@1*/
        for (int v : g[u]) if (!vis[v]) { vis[v] = true; q.push(v); }
    }
}`
,`void bfs(List<List<Integer>> g, int s) {
    Queue<Integer> q = new LinkedList<>();
    boolean[] vis = new boolean[g.size()]; q.offer(s); vis[s] = true;
    while (!q.isEmpty()) {
        int u = q.poll(); visit(u); /*@1*/
        for (int v : g.get(u)) if (!vis[v]) { vis[v] = true; q.offer(v); }
    }
}`
,`def bfs(g: list, s: int) -> None:
    q, vis = [s], {s}
    while q:
        u = q.pop(0); visit(u)  # @1
        for v in g[u]:
            if v not in vis: vis.add(v); q.append(v)`);
    if (action === 'dfs-op') return pack(
`void dfs(vector<vector<int>>& g, int u, bool* vis) {
    visit(u); vis[u] = true; /*@1*/
    for (int v : g[u]) if (!vis[v]) dfs(g, v, vis);
}`
,`void dfs(List<List<Integer>> g, int u, boolean[] vis) {
    visit(u); vis[u] = true; /*@1*/
    for (int v : g.get(u)) if (!vis[v]) dfs(g, v, vis);
}`
,`def dfs(g: list, u: int, vis: set) -> None:
    visit(u); vis.add(u)  # @1
    for v in g[u]:
        if v not in vis: dfs(g, v, vis)`);
    return graphOps('add-edge');
  }

  // ─── 哈希操作 ───
  function hashOps(action, demo) {
    if (action === 'create') return pack(
`vector<list<int>> createHash(int n) {
    vector<list<int>> t(n); /*@0*/
    int key = 42, h = key % n; t[h].push_back(key); /*@1*/
    return t;
}`
,`List<List<Integer>> createHash(int n) {
    List<List<Integer>> t = new ArrayList<>(n); /*@0*/
    int key = 42, h = key % n; t.get(h).add(key); /*@1*/
    return t;
}`
,`def create_hash(n: int) -> list:
    t = [[] for _ in range(n)]  # @0
    key, h = 42, 42 % n; t[h].append(key)  # @1
    return t`);
    if (action === 'delete') return pack(
`void deleteKey(vector<list<int>>& t, int key) {
    int h = key % t.size(); /*@0*/
    t[h].remove(key); /*@1*/
}`
,`void deleteKey(List<List<Integer>> t, int key) {
    int h = key % t.size(); /*@0*/
    t.get(h).remove(Integer.valueOf(key)); /*@1*/`
,`def delete_key(t: list, key: int) -> None:
    h = key % len(t)  # @0
    t[h].remove(key)  # @1`);
    if (action === 'search') return pack(
`bool search(vector<list<int>>& t, int key) {
    int h = key % t.size(); /*@0*/
    for (int x : t[h]) if (x == key) return true; /*@1*/
    return false;
}`
,`boolean search(List<List<Integer>> t, int key) {
    int h = key % t.size(); /*@0*/
    for (int x : t.get(h)) if (x == key) return true; /*@1*/
    return false;
}`
,`def search(t: list, key: int) -> bool:
    h = key % len(t)  # @0
    for x in t[h]:
        if x == key: return True  # @1
    return False`);
    // traverse
    return pack(
`void traverse(vector<list<int>>& t) {
    for (auto& b : t)
        for (int x : b) visit(x); /*@1*/
}`
,`void traverse(List<List<Integer>> t) {
    for (List<Integer> b : t)
        for (int x : b) visit(x); /*@1*/
}`
,`def traverse(t: list) -> None:
    for b in t:
        for x in b: visit(x)  # @1`);
  }

  // ─── 排序辅助操作 ───
  function sortOps(action) {
    if (action === 'create') return pack(
`int* createData(int* src, int n) {
    int* a = new int[n]; /*@0*/
    for (int i = 0; i < n; ++i) a[i] = src[i]; /*@1*/
    return a;
}`
,`int[] createData(int[] src) {
    int[] a = new int[src.length]; /*@0*/
    for (int i = 0; i < src.length; i++) a[i] = src[i]; /*@1*/
    return a;
}`
,`def create_data(src: list[int]) -> list[int]:
    a = [0] * len(src)  # @0
    for i, v in enumerate(src): a[i] = v  # @1
    return a`);
    if (action === 'access') return pack(
`int access(int* a, int n, int pos) {
    if (pos < 0 || pos >= n) throw std::out_of_range(""); /*@0*/
    return a[pos]; /*@1*/
}`
,`int access(int[] a, int pos) {
    if (pos < 0 || pos >= a.length) throw new IndexOutOfBoundsException(); /*@0*/
    return a[pos]; /*@1*/
}`
,`def access(a: list, pos: int) -> int:
    if pos < 0 or pos >= len(a): raise IndexError  # @0
    return a[pos]  # @1`);
    // traverse
    return pack(
`void traverse(int* a, int n) {
    for (int i = 0; i < n; ++i)
        visit(a[i]); /*@0*/
}`
,`void traverse(int[] a) {
    for (int v : a)
        visit(v); /*@0*/
}`
,`def traverse(a: list) -> None:
    for v in a:
        visit(v)  # @0`);
  }

  // ─── 查找辅助操作 ───
  function searchOps(action) { return sortOps(action); }

})();
