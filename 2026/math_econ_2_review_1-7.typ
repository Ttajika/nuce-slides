// 経済数学2 復習問題（第1回〜第7回）
// math_econ_2_practice.typ から基本的な問題を抜粋
// 使い方:
//   typst compile math_econ_2_review_1-7.typ                       → 問題のみ
//   typst compile --input answers=true math_econ_2_review_1-7.typ  → 略解つき

#let show-answers = sys.inputs.at("answers", default: "false") == "true"

#set page(paper: "a4", margin: (x: 20mm, y: 20mm), numbering: "1")
#set text(font: ("Hiragino Kaku Gothic ProN", "Harano Aji Mincho"), size: 10.5pt, lang: "ja")
#set par(justify: true, leading: 0.9em, spacing: 1.1em)
#set enum(spacing: 1.3em)
#show enum: set text(top-edge: "bounds", bottom-edge: "bounds")
#set math.vec(gap: 0.45em)
#set math.mat(row-gap: 0.45em, column-gap: 0.8em)
#show math.equation.where(block: true): set block(spacing: 1em)
#set heading(numbering: none)
#show heading.where(level: 2): it => block(above: 2em, below: 0.6em, width: 100%, stroke: (bottom: 0.5pt + gray), inset: (bottom: 3pt), text(size: 12pt, it.body))

// ───────── ユーティリティ ─────────
#let prob-counter = counter("prob")
#let prob(src: none, body) = {
  prob-counter.step()
  block(above: 1.8em, below: 0.8em, breakable: false)[
    #text(weight: "bold")[問 #context prob-counter.display()]
    #if src != none [#h(0.4em)#text(size: 8.5pt, fill: gray)[（#src）]]
    #h(0.5em)#body
  ]
}
#let ans(body) = if show-answers {
  block(
    inset: (x: 0.8em, y: 0.6em), width: 100%,
    fill: rgb("#f3f6fb"), stroke: (left: 2pt + rgb("#3b6fb6")), radius: 2pt,
    breakable: true,
  )[
    #text(size: 9.5pt)[#text(weight: "bold", fill: rgb("#3b6fb6"))[略解]#h(0.5em)#body]
  ]
}
#let ruiji = text(fill: rgb("#b55d00"))[類題]
#let blank(s) = box(stroke: 0.5pt, inset: 2pt)[#s]

// 記法の短縮
// インラインでも列ベクトルを縮めずに表示
#let bv(..xs) = math.display(math.vec(delim: "[", ..xs))
#let bm(..xs) = math.display(math.mat(delim: "[", ..xs))

// ───────── タイトル ─────────
#align(center)[
  #text(size: 17pt, weight: "bold")[経済数学 2　復習問題（第 1 回〜第 7 回）]
  #v(0.2em)
  #text(size: 10pt, fill: gray)[#if show-answers [略解つき版] else [問題のみ版]]
]
#v(0.3em)
#text(size: 9.5pt)[出典が「#ruiji」の問題は過去問と同じテーマで新しく作った問題，それ以外は過去の期末試験の問題です．]

// ═══════════════════════════════════════════════════════
== 第 1 回　ベクトル・一次独立

#prob(src: "2024 試験1 問1")[
次のベクトル組が一次独立か，そうでないかを判定し，その理由を説明しなさい．
+ $bv(1, 0), bv(0, 1)$
+ $bv(1, 1), bv(2, 2)$
+ $bv(1, 0, 1), bv(0, 1, 1), bv(1, 1, 2)$
]
#ans[
+ 一次独立．$alpha bv(1,0) + beta bv(0,1) = bv(alpha, beta) = bv(0,0)$ となるのは $alpha = beta = 0$ のときだけ．
+ 一次独立でない．$bv(2,2) = 2 bv(1,1)$ なので $2 bv(1,1) - bv(2,2) = 0$ という自明でない線形和がある．
+ 一次独立でない．$bv(1,0,1) + bv(0,1,1) = bv(1,1,2)$ である．
]

#prob(src: ruiji)[
$bv(1, 2), bv(3, 4)$ が一次独立であることを，定義（$alpha bv(1,2) + beta bv(3,4) = bv(0,0)$ ならば $alpha = beta = 0$）にしたがって示しなさい．また，$bv(5, 6)$ をこの 2 つのベクトルの線形和として表しなさい．
]
#ans[
$alpha + 3 beta = 0$, $2 alpha + 4 beta = 0$ より，第 2 式 − 第 1 式 $times 2$ で $-2 beta = 0$，よって $beta = 0$, $alpha = 0$．
$bv(5,6) = alpha bv(1,2) + beta bv(3,4)$ とすると $alpha + 3 beta = 5$, $2 alpha + 4 beta = 6$．解くと $beta = 2$, $alpha = -1$．すなわち $bv(5,6) = -bv(1,2) + 2 bv(3,4)$．
]

// ═══════════════════════════════════════════════════════
== 第 2 回　行列式

#prob(src: ruiji)[
次の行列式を計算しなさい．また，$bv(2, 1), bv(1, 3)$ がなす平行四辺形の面積を答えなさい．
$ det bm(2, 1; 1, 3), quad det bm(1, 2; 2, 4), quad det bm(0, -3; 5, 2) $
]
#ans[
$6 - 1 = 5$，$4 - 4 = 0$，$0 - (-15) = 15$．平行四辺形の面積は $abs(5) = 5$．
]

#prob(src: "2024 試験1 問3")[
$A = bm(a_11, a_21; a_12, a_22)$, $E = bm(1, 0; 0, 1)$ とする．行列式の性質（分配法則，スカラー倍法則，一致退化法則，交代法則）のみを用いて $det(A) = (a_11 a_22 - a_12 a_21) det(E)$ を示したい．その証明を完成させるように以下の空欄を埋めよ．

#block(inset: 0.8em, stroke: 0.5pt + gray, radius: 4pt, width: 100%)[
$e_1 = bv(1, 0)$, $e_2 = bv(0, 1)$ と置く．このとき，以下の通りの式が成立する．
$ bv(a_11, a_12) = #blank[ア] e_1 + #blank[イ] e_2, quad bv(a_21, a_22) = #blank[ウ] e_1 + #blank[エ] e_2 $
行列式の分配法則より，
$ det(A) &= det(#blank[ア] e_1, #blank[ウ] e_1 + #blank[エ] e_2) + det(#blank[イ] e_2, #blank[ウ] e_1 + #blank[エ] e_2) \
&= det(#blank[ア] e_1, #blank[ウ] e_1) + #blank[オ] + det(#blank[イ] e_2, #blank[ウ] e_1) + #blank[カ] $
スカラー倍法則と一致退化法則から $det(#blank[ア] e_1, #blank[ウ] e_1) = #blank[カ] = #blank[キ]$ である．また，交代法則とスカラー倍法則を用いると次のような式変形ができる．
$ #blank[オ] = #blank[ク] det(e_1, e_2), quad det(#blank[イ] e_2, #blank[ウ] e_1) = #blank[ケ] det(e_1, e_2) $
したがって，$det(A) = (a_11 a_22 - a_12 a_21) det(E)$ が成り立つ．
]
]
#ans[
ア $a_11$，イ $a_12$，ウ $a_21$，エ $a_22$，オ $det(a_11 e_1, a_22 e_2)$，カ $det(a_12 e_2, a_22 e_2)$，キ $0$，ク $a_11 a_22$，ケ $-a_12 a_21$．
]

#prob(src: "2025 試験1 問2")[
ベクトル $bv(a, b), bv(c, d)$ がなす平行四辺形の面積が，$abs(det lr((bv(a, b), bv(c, d))))$ と等しいことを図を用いて示しなさい．
]
#ans[
（$a, b, c, d > 0$ かつ $bv(a,b)$ が $bv(c,d)$ より時計回り側にある場合）原点，$bv(a,b)$, $bv(a+c, b+d)$, $bv(c,d)$ を頂点とする平行四辺形を，$(a+c) times (b+d)$ の長方形の中に描く．長方形から，直角三角形 2 つ（面積 $a b / 2$ ずつ），直角三角形 2 つ（面積 $c d / 2$ ずつ），長方形 2 つ（面積 $b c$ ずつ）を除くと
$ (a+c)(b+d) - a b - c d - 2 b c = a d - b c = det lr((bv(a,b), bv(c,d))) . $
ベクトルの並び順が逆の場合は符号が逆になるので，絶対値をとれば面積になる．
]

// ═══════════════════════════════════════════════════════
== 第 3 回　クラメルの公式

#prob(src: ruiji)[
次の連立方程式をクラメルの公式を用いて解きなさい．どの行列式を計算しているかが分かるように書くこと．
$ cases(2x + y = 5, x + 3y = 5) $
]
#ans[
$det bm(2, 1; 1, 3) = 5$．$x = det bm(5, 1; 5, 3) slash 5 = (15 - 5) / 5 = 2$，$y = det bm(2, 5; 1, 5) slash 5 = (10 - 5) / 5 = 1$．
]

#prob(src: "2024 試験1 問2")[
以下の連立方程式の解 $(x, y, z)$ のうち，$x$ の値を，$det, arrow(a), arrow(b), arrow(c), arrow(d)$ のみを用いて示し，そのことを行列式の性質を用いて証明せよ．ただし，$arrow(a), arrow(b), arrow(c), arrow(d)$ はそれぞれ 3 成分の列ベクトルであり，$det(arrow(a), arrow(b), arrow(c)) != 0$ とする．
$ arrow(a) x + arrow(b) y + arrow(c) z = arrow(d) $
]
#ans[
$x = det(arrow(d), arrow(b), arrow(c)) / det(arrow(a), arrow(b), arrow(c))$．
証明：$arrow(d) = arrow(a) x + arrow(b) y + arrow(c) z$ を代入し，分配法則とスカラー倍法則を使うと
$ det(arrow(d), arrow(b), arrow(c)) = x det(arrow(a), arrow(b), arrow(c)) + y det(arrow(b), arrow(b), arrow(c)) + z det(arrow(c), arrow(b), arrow(c)) . $
一致退化法則より第 2 項と第 3 項は $0$．よって $det(arrow(d), arrow(b), arrow(c)) = x det(arrow(a), arrow(b), arrow(c))$ となり，$det(arrow(a), arrow(b), arrow(c)) != 0$ で割れば結論を得る．
]

#prob(src: ruiji)[
$arrow(a) x + arrow(b) y = arrow(d)$（$arrow(a), arrow(b), arrow(d)$ は 2 成分の列ベクトル，$det(arrow(a), arrow(b)) != 0$）について，$y$ を $det, arrow(a), arrow(b), arrow(d)$ のみで表し，そのことを行列式の性質を用いて証明しなさい．
]
#ans[
$y = det(arrow(a), arrow(d)) / det(arrow(a), arrow(b))$．$det(arrow(a), arrow(d)) = det(arrow(a), arrow(a) x + arrow(b) y) = x det(arrow(a), arrow(a)) + y det(arrow(a), arrow(b)) = y det(arrow(a), arrow(b))$．
]

// ═══════════════════════════════════════════════════════
== 第 4 回　余因子展開

#prob(src: "2023 試験2 問1 ／ " + ruiji)[
余因子展開を用いて次の行列式を計算しなさい．
$ "(1)" det bm(lambda, 0, 0; 0, mu, 0; 0, 0, nu), quad quad "(2)" det bm(1, 2, 0; 0, 1, 3; 2, 0, 1) $
]
#ans[
(1) 第 1 行で余因子展開すると $lambda det bm(mu, 0; 0, nu) - 0 + 0 = lambda mu nu$．
(2) 第 1 行で展開して $1 dot (1 dot 1 - 3 dot 0) - 2 dot (0 dot 1 - 3 dot 2) + 0 = 1 + 12 = 13$．
]

#prob(src: "2025 試験2 問1")[
$ det bm(a_1, b_1, c_1; a_2, b_2, c_2; a_3, b_3, c_3) = a_1 det bm(b_2, c_2; b_3, c_3) - b_1 det bm(a_2, c_2; a_3, c_3) + c_1 det bm(a_2, b_2; a_3, b_3) $
と計算できるということを，行列式の性質（一致退化法則，交代法則，スカラー倍法則，分配法則）を用いて説明しなさい．
]
#ans[
（方針）$e_1, e_2, e_3$ を単位ベクトルとし，第 1 行に注目して各列ベクトルを $arrow(a) = a_1 e_1 + arrow(a)'$，$arrow(b) = b_1 e_1 + arrow(b)'$，$arrow(c) = c_1 e_1 + arrow(c)'$（$arrow(a)' = bv(0, a_2, a_3)$ など）と分解する．分配法則で展開すると，$e_1$ を 2 つ以上含む項は一致退化法則（とスカラー倍法則）で $0$．残るのは
$ a_1 det(e_1, arrow(b)', arrow(c)') + b_1 det(arrow(a)', e_1, arrow(c)') + c_1 det(arrow(a)', arrow(b)', e_1) + det(arrow(a)', arrow(b)', arrow(c)') . $
最後の項は 3 つのベクトルの第 1 成分がすべて $0$ なので一次従属となり $0$．交代法則で $e_1$ を第 1 列に移すと，第 2 項は $-b_1 det(e_1, arrow(a)', arrow(c)')$，第 3 項は $+c_1 det(e_1, arrow(a)', arrow(b)')$（2 回入れ替え）．そして $det(e_1, arrow(b)', arrow(c)') = det bm(b_2, c_2; b_3, c_3)$ である（第 1 列が $e_1$ の行列式は，残りの $2 times 2$ の行列式に等しい）ことから結論を得る．
]

// ═══════════════════════════════════════════════════════
== 第 5 回　行列・行列の演算

#prob(src: "2024 試験2 問2")[
ベクトルを別のベクトルに作用させる以下の関数（ベクトル関数）を考える．
$ f lr((bv(x_1, x_2))) = bv(y_1, y_2) $
+ $f$ が線形性を満たすとはどういうことかを説明しなさい．
+ $f$ が線形性を満たすとき，$f lr((bv(1, 0))) = bv(3, 2)$，$f lr((bv(0, 1))) = bv(-2, 4)$ だという．このとき，$f lr((bv(x_1, x_2)))$ の値を求めなさい．
+ 2 の条件のもとで $f lr((bv(x_1, x_2))) = A bv(x_1, x_2)$ と書くことができる．行列 $A$ を求めなさい．
]
#ans[
+ 任意のスカラー $alpha, beta$ とベクトル $x, y$ について $f(alpha x + beta y) = alpha f(x) + beta f(y)$ が成り立つこと．
+ $f lr((bv(x_1, x_2))) = x_1 f lr((bv(1,0))) + x_2 f lr((bv(0,1))) = bv(3 x_1 - 2 x_2, 2 x_1 + 4 x_2)$．
+ $A = bm(3, -2; 2, 4)$．
]

#prob(src: "2023 試験2 問3・問4")[
+ $A = bm(3, -1; 12, -4)$ とするとき，$A A$ を計算しなさい．
+ $A = bm(3, -1; 9, -3)$ とするとき，$A A$ を計算しなさい．
]
#ans[
+ $A A = bm(9 - 12, -3 + 4; 36 - 48, -12 + 16) = bm(-3, 1; -12, 4) = -A$．
+ $A A = bm(9 - 9, -3 + 3; 27 - 27, -9 + 9) = bm(0, 0; 0, 0)$．（零行列でない行列の積が零行列になりうる例）
]

#prob(src: "2025 試験1 問1")[
$2 times 2$ 行列 $A, B$ について，$A = bm(a, b; c, d)$，$B = bm(e, f; g, h)$ と記号でおき，$(A B)^top = B^top A^top$ を計算によって確かめなさい．
]
#ans[
$A B = bm(a e + b g, a f + b h; c e + d g, c f + d h)$ なので $(A B)^top = bm(a e + b g, c e + d g; a f + b h, c f + d h)$．一方 $B^top A^top = bm(e, g; f, h) bm(a, c; b, d) = bm(e a + g b, e c + g d; f a + h b, f c + h d)$ で一致する．
]

#prob(src: "2025 試験1 問3 / 2025 試験2 問3")[
+ $f$ を 3 成分のベクトル $x = bv(x_1, x_2, x_3)$ を 4 成分のベクトル $bv(y_1, y_2, y_3, y_4)$ に写す関数であるとする．$f$ が線形性を満たすとき，$f(x) = A x$ と書けることを示し，$A$ がどのような行列か答えなさい．
+ $f$ を 4 成分のベクトル $x = bv(x_1, x_2, x_3, x_4)$ を 3 成分のベクトル $bv(y_1, y_2, y_3)$ に写す関数であるとする．$f$ が線形性を満たすとき，$f(x) = A x$ と書けることを示し，$A$ がどのような行列か答えなさい．
]
#ans[
+ 単位ベクトル $e_1, e_2, e_3$ を用いると $x = x_1 e_1 + x_2 e_2 + x_3 e_3$．線形性より $f(x) = x_1 f(e_1) + x_2 f(e_2) + x_3 f(e_3)$．$f(e_j) = bv(a_(1 j), a_(2 j), a_(3 j), a_(4 j))$ と置き，これを列に並べた $4 times 3$ 行列 $A = [f(e_1), f(e_2), f(e_3)]$ を用いると $f(x) = A x$．
+ 同様に，$A = [f(e_1), f(e_2), f(e_3), f(e_4)]$ は $3 times 4$ 行列．
]

// ═══════════════════════════════════════════════════════
== 第 6 回　逆行列

#prob(src: "2022 試験2 問2")[
$2 times 2$ の行列 $A$ について，逆行列 $A^(-1)$ とはどのような行列か．説明しなさい．
]
#ans[
$A A^(-1) = A^(-1) A = E$（単位行列）を満たす行列．$A = bm(a, b; c, d)$ のとき，$det(A) = a d - b c != 0$ ならば存在し，
$ A^(-1) = 1 / (a d - b c) bm(d, -b; -c, a) $
で与えられる．$det(A) = 0$ のときは存在しない．
]

#prob(src: "2023 試験2 問2")[
$2 times 2$ 行列 $A$ について，$A^(-1)$ が $A$ の逆行列であるとは $A A^(-1) = bm(1, 0; 0, 1)$ となることを言う．この定義に従って $B = bm(-4, -7; 1, 2)$ が $A = bm(-2, -7; 1, 4)$ の逆行列であることを示しなさい．
]
#ans[
$A B = bm((-2)(-4) + (-7)(1), (-2)(-7) + (-7)(2); (1)(-4) + (4)(1), (1)(-7) + (4)(2)) = bm(1, 0; 0, 1)$．
]

#prob(src: ruiji)[
+ $A = bm(2, 1; 1, 3)$ の逆行列を求め，$A A^(-1) = E$ となることを確かめなさい．
+ $B = bm(1, 2; 2, 4)$ に逆行列が存在しない理由を説明しなさい．
+ 1 の $A$ を用いて，連立方程式 $A bv(x, y) = bv(5, 5)$ を逆行列によって解きなさい．
]
#ans[
+ $det(A) = 5$ より $A^(-1) = 1/5 bm(3, -1; -1, 2)$．$A A^(-1) = 1/5 bm(6 - 1, -2 + 2; 3 - 3, -1 + 6) = E$．
+ $det(B) = 4 - 4 = 0$ だから．（あるいは：$B$ の 2 つの列が一次従属なので $B x = e_1$ が解けない．）
+ $bv(x, y) = A^(-1) bv(5, 5) = 1/5 bv(15 - 5, -5 + 10) = bv(2, 1)$．
]

// ═══════════════════════════════════════════════════════
== 第 7 回　行列で表現できるもの（ネットワーク，線形モデル）

#prob(src: ruiji)[
3 人（1, 2, 3）からなるネットワークで，1 と 2，2 と 3 が繋がっており，1 と 3 は繋がっていない．
+ 隣接行列 $G$（$i$ と $j$ が繋がっていれば $g_(i j) = 1$，そうでなければ $0$）を書きなさい．
+ $G^2 = G G$ を計算し，その $(1, 3)$ 成分と $(2, 2)$ 成分が何を意味しているか説明しなさい．
]
#ans[
+ $G = bm(0, 1, 0; 1, 0, 1; 0, 1, 0)$．
+ $G^2 = bm(1, 0, 1; 0, 2, 0; 1, 0, 1)$．$(G^2)_(i j)$ は $i$ から $j$ へちょうど 2 歩で行く経路の数．$(1,3)$ 成分 $= 1$ は 1→2→3 の 1 通り，$(2,2)$ 成分 $= 2$ は 2→1→2 と 2→3→2 の 2 通り．
]

#prob(src: ruiji)[
3 個のデータ $(x_1, y_1) = (1, 2)$，$(x_2, y_2) = (2, 3)$，$(x_3, y_3) = (3, 5)$ があり，$y_k = beta_0 + beta_1 x_k + epsilon_k$ という関係を仮定する．この 3 本の式をまとめて $y = X beta + epsilon$（$beta = bv(beta_0, beta_1)$）と書くとき，ベクトル $y$，行列 $X$ を具体的に書きなさい．
]
#ans[
$y = bv(2, 3, 5)$，$X = bm(1, 1; 1, 2; 1, 3)$（$3 times 2$ 行列），$epsilon = bv(epsilon_1, epsilon_2, epsilon_3)$．
]
