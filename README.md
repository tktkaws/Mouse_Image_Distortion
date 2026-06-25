# Mouse Image Distortion - Static Reproduction

このディレクトリは、元の Next.js / React Three Fiber 実装を、HTML、Tailwind CSS、バニラ JavaScript、Three.js で再現したものです。

プロジェクト名にマウスを乗せると画像が表示され、画像がマウスに追従しながら少し歪むデモです。

## 使用技術

- HTML
- Tailwind CSS CDN
- バニラ JavaScript
- Three.js
- GLSL シェーダー

React、Next.js、React Three Fiber、Framer Motion は使っていません。

## ファイル構成

```txt
static-reproduction/
├─ index.html
├─ package.json
└─ src/
   ├─ data.js
   ├─ main.js
   └─ shaders.js
```

### `index.html`

画面の土台です。

主な役割は次の3つです。

- Tailwind CSS を CDN で読み込む
- Three.js を import map で読み込めるようにする
- プロジェクト一覧と WebGL の描画エリアを用意する

```html
<ul id="project-list" class="border-b border-white/80"></ul>
<div id="webgl-stage" class="pointer-events-none fixed inset-0 h-screen w-full"></div>
```

`#project-list` には JavaScript でプロジェクト名のリストを追加します。

`#webgl-stage` には Three.js の `canvas` が追加されます。`pointer-events-none` を付けているので、Canvas が上に重なっていても、下のリストにマウスイベントが届きます。

### `src/data.js`

表示するプロジェクト名と画像パスを管理しています。

```js
export const projects = [
  {
    title: "Richard Gaston",
    src: "../public/images/5.jpg",
  },
];
```

プロジェクトを増やしたい場合は、この配列にオブジェクトを追加します。

画像は `../public/images/1.jpg` から `7.jpg` を参照しています。画像ファイルが存在しない場合でも、デモが壊れないように `main.js` 側でプレースホルダー画像を生成します。

### `src/shaders.js`

画像を歪ませる GLSL コードを書いています。

Three.js では通常の CSS だけでは WebGL の頂点を変形できません。そのため、`ShaderMaterial` に渡すための頂点シェーダーとフラグメントシェーダーを用意しています。

頂点シェーダーでは、画像を貼った平面の頂点位置を少し動かしています。

```js
newPosition.x += sin(uv.y * PI) * uDelta.x * uAmplitude;
newPosition.y += sin(uv.x * PI) * uDelta.y * uAmplitude;
```

ここで使っている値は次の意味です。

- `uv`: 画像上の位置。左下から右上まで 0 から 1 の範囲で表されます。
- `uDelta`: マウスの移動量です。速く動かすほど値が大きくなります。
- `uAmplitude`: 歪みの強さです。今は `0.0005` にしています。
- `sin(...)`: 歪みが直線的になりすぎないよう、波のように変化させています。

フラグメントシェーダーでは、画像の色と透明度を決めています。

```js
vec3 texture = texture2D(uTexture, vUv).rgb;
gl_FragColor = vec4(texture, uAlpha);
```

`uAlpha` を 0 から 1 に変えることで、画像をフェードイン・フェードアウトさせています。

### `src/main.js`

このデモの中心です。

主に次の処理をしています。

- HTML にプロジェクト一覧を作る
- Three.js の renderer / scene / camera を作る
- 画像テクスチャを読み込む
- マウス位置を保存する
- ホバー中のプロジェクトに合わせて画像を切り替える
- 毎フレーム、画像の位置と歪みを更新する
- 画面リサイズに対応する

## 処理の流れ

全体の流れは次の通りです。

```txt
1. index.html が読み込まれる
2. main.js が実行される
3. data.js の projects からリストを作る
4. Three.js の Canvas を作る
5. 画像を Texture として読み込む
6. マウス移動を監視する
7. リストにホバーしたら表示画像を切り替える
8. requestAnimationFrame で毎フレーム描画する
```

## Three.js の初期化

`main.js` では、最初に Three.js の基本セットを作ります。

```js
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 5;
```

それぞれの役割は次の通りです。

- `renderer`: WebGL で画面に描画する担当です。
- `scene`: 3D オブジェクトを置く空間です。
- `camera`: scene をどこから見るかを決めます。

このデモでは、画像を貼るために1枚の平面を作っています。

```js
const geometry = new THREE.PlaneGeometry(1, 1, 15, 15);
const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
  transparent: true,
});
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);
```

`PlaneGeometry(1, 1, 15, 15)` の `15, 15` は分割数です。

平面が細かく分割されているほど、頂点シェーダーで歪ませたときに滑らかに見えます。分割が `1, 1` だと頂点が少なすぎて、きれいに歪みません。

## uniforms とは

`uniforms` は、JavaScript からシェーダーへ渡す値です。

```js
const uniforms = {
  uDelta: { value: new THREE.Vector2(0, 0) },
  uAmplitude: { value: 0.0005 },
  uTexture: { value: textures[0] },
  uAlpha: { value: 0 },
};
```

このデモでは次の値を渡しています。

- `uDelta`: マウスの移動量。画像の歪みに使います。
- `uAmplitude`: 歪みの強さ。数値を大きくすると歪みも大きくなります。
- `uTexture`: 表示する画像。
- `uAlpha`: 透明度。0 で非表示、1 で表示です。

JavaScript 側で `uniforms.uAlpha.value` などを書き換えると、次の描画フレームでシェーダーに反映されます。

## マウス追従の仕組み

マウス座標は `pointermove` で保存しています。

```js
window.addEventListener("pointermove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});
```

ただし、マウス位置をそのまま画像に反映すると動きが硬くなります。

そこで `smoothMouse` という少し遅れて追従する座標を用意しています。

```js
smoothMouse.x = lerp(previousX, mouse.x, 0.1);
smoothMouse.y = lerp(previousY, mouse.y, 0.1);
```

`lerp` は「現在地から目的地へ少しだけ近づける」関数です。

```js
function lerp(start, end, amount) {
  return start * (1 - amount) + end * amount;
}
```

`amount` が `0.1` なので、毎フレーム10%ずつマウス位置へ近づきます。これにより、画像がなめらかに追従しているように見えます。

## 画面座標から Three.js 座標への変換

ブラウザのマウス座標は、左上が `(0, 0)` です。

一方で Three.js の座標は、画面の中心が `(0, 0)` です。

そのため、`mapRange` で座標を変換しています。

```js
plane.position.x = mapRange(
  smoothMouse.x,
  0,
  window.innerWidth,
  -viewport.width / 2,
  viewport.width / 2,
);
```

X方向は次のように変換されます。

```txt
ブラウザ左端 0              -> Three.js 左側 -viewport.width / 2
ブラウザ中央 innerWidth / 2 -> Three.js 中央 0
ブラウザ右端 innerWidth     -> Three.js 右側 viewport.width / 2
```

Y方向は上下が逆なので、変換先の順番を逆にしています。

```js
plane.position.y = mapRange(
  smoothMouse.y,
  0,
  window.innerHeight,
  viewport.height / 2,
  -viewport.height / 2,
);
```

## 画像の歪み方

マウスが動いたとき、前の `smoothMouse` と現在の `mouse` の差を `uDelta` に入れます。

```js
uniforms.uDelta.value.set(mouse.x - previousX, -1 * (mouse.y - previousY));
```

この差が大きいほど、画像が大きく歪みます。

マウスが止まっているときは、歪みを少しずつ弱めます。

```js
uniforms.uDelta.value.multiplyScalar(0.92);
```

`multiplyScalar(0.92)` は、今の値に 0.92 を掛ける処理です。毎フレーム少しずつ小さくなるので、歪みが自然に収まっていきます。

## ホバーで画像を切り替える仕組み

プロジェクト名のリストは、`data.js` の `projects` を元に作っています。

```js
projects.forEach((project, index) => {
  const item = projectItemTemplate.content.firstElementChild.cloneNode(true);
  item.addEventListener("mouseenter", () => setActiveProject(index));
});
```

マウスが項目に乗ると `setActiveProject(index)` が呼ばれます。

```js
function setActiveProject(index) {
  activeProject = index;

  if (index === null) {
    startFade(0);
    return;
  }

  currentTextureIndex = index;
  uniforms.uTexture.value = textures[index];
  updatePlaneScale();
  startFade(1);
}
```

ここでは次のことをしています。

- 表示中のプロジェクト番号を保存する
- `uTexture` に表示したい画像を入れる
- 画像の比率に合わせて平面サイズを調整する
- `uAlpha` を 1 に近づけてフェードインする

リストからマウスが出たときは `setActiveProject(null)` が呼ばれ、`uAlpha` が 0 に近づいてフェードアウトします。

## 画像サイズの調整

画像には縦長・横長などいろいろな比率があります。

そのため、画像の幅と高さを見て、平面の `scale` を調整しています。

```js
const imageWidth = image.naturalWidth || image.width || 1024;
const imageHeight = image.naturalHeight || image.height || 768;
const scale = getAspectScale(imageWidth, imageHeight, 0.225);

plane.scale.set(scale.x, scale.y, 1);
```

これにより、画像が極端につぶれて表示されにくくなります。

## プレースホルダー画像

リポジトリには `public/images/1.jpg` から `7.jpg` が入っていない場合があります。

画像読み込みに失敗した場合は、`createPlaceholderTexture` で Canvas から仮画像を作ります。

```js
textureLoader.load(
  project.src,
  (texture) => {
    textures[index] = texture;
  },
  undefined,
  () => {
    textures[index] = createPlaceholderTexture(project.title, index);
  },
);
```

これにより、画像ファイルがなくてもホバーや歪みの動作確認ができます。

## 起動方法

ES Modules を使っているため、ファイルを直接ダブルクリックするより、ローカルサーバーで開くのがおすすめです。

`mouse-image-distortion` ディレクトリで次のコマンドを実行します。

```sh
npx serve .
```

または Python が使える場合は次のコマンドでも確認できます。

```sh
python -m http.server 4173
```

その後、ブラウザで次の URL を開きます。

```txt
http://localhost:4173/static-reproduction/
```

`npx serve .` を使う場合は、ターミナルに表示された URL に `/static-reproduction/` を付けて開いてください。

## カスタマイズのヒント

### 歪みを強くしたい

`main.js` の `uAmplitude` を大きくします。

```js
uAmplitude: { value: 0.0005 },
```

例:

```js
uAmplitude: { value: 0.001 },
```

### 画像を大きくしたい

`updatePlaneScale` 内で使っている `0.225` を大きくします。

```js
const scale = getAspectScale(imageWidth, imageHeight, 0.225);
```

### フェードを遅くしたい

`fade.duration` を長くします。

```js
duration: 200,
```

単位はミリ秒です。`500` にすると 0.5 秒になります。

## 学習ポイント

この実装で特に大事なのは次の4つです。

- DOM のリスト表示は普通の JavaScript で作れる
- Three.js は `renderer`、`scene`、`camera`、`mesh` の組み合わせで描画する
- 毎フレーム変えたい値は `requestAnimationFrame` の中で更新する
- シェーダーに渡したい値は `uniforms` 経由で更新する

最初は `main.js` の全体を一気に理解しようとせず、`renderProjectList`、`bindEvents`、`animate`、`setActiveProject` の順に読むと流れを追いやすいです。
