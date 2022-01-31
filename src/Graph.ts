import { Edge } from "./Edge";
import { GraphError } from "./Error";
import { Vertex } from "./Vertex";

type VertexMap = Record<number, Vertex>;
type EdgeMap = Record<string, Edge>;
type EdgeSiblings = Record<string, number[]>;
interface GraphOptions {
  opEvents?: boolean;
}

const getNextIndex = (v: number[]): number =>
  v.length < 1 ? 0 : <number>v.at(-1) + 1;
const vertexIdx = (v: number | Vertex) =>
  v instanceof Vertex ? (v as Vertex).idx : v;
const edgeIdx = (v: string | Edge) => (v instanceof Edge ? (v as Edge).idx : v);

export class Graph {
  [x: string]: any;
  constructor(options: GraphOptions = {}) {
    const { opEvents = false } = options;
    this._vertices = Object.create(null) as VertexMap;
    this._edges = Object.create(null) as EdgeMap;
    this._edgeSiblings = Object.create(null) as EdgeSiblings;
    this._hasOpEvents = opEvents;
    this._stackIdx = 0;
    this._eventsStack = [];
  }
  // Vertices API
  /**
   * Getter, returns an array of vertices
   */
  public get vertices(): Vertex[] {
    return Object.values(this._vertices as VertexMap);
  }
  public addVertex(vertex: Vertex): [GraphError?, Vertex?] {
    const idx = vertexIdx(vertex);
    const instance = this._vertices[idx];
    if (instance) {
      return [
        new GraphError("Vertex with the same `idx` already exists"),
        vertex,
      ];
    }
    this._vertices[idx] = vertex;
    return [, vertex];
  }
  /**
   * Create a new vertex with the given numeric `id`.
   * If the vertex with this `id` already exists then return the existing instance
   * @todo Should it return an error instead ?
   * @param {number} idx
   * @param {any} data
   * @returns {[GraphError?, Vertex?]}
   */
  public createVertex(idx: number, data?: any): [GraphError?, Vertex?] {
    if (!!(this._vertices as VertexMap)[idx]) {
      return [
        new GraphError("Duplicate vertex `idx`"),
        <Vertex>(this._vertices as VertexMap)[idx],
      ];
    }
    const vertex = new Vertex(idx, data);
    (this._vertices as VertexMap)[idx] = vertex;
    return [, vertex];
  }
  /**
   *
   * @param vertex
   * @returns
   */
  public removeVertex(vertex: number | Vertex): boolean {
    const idx = vertexIdx(vertex);
    const vertexToRemove = <Vertex>this._vertices[idx];
    if (!vertexToRemove) {
      return false;
    }
    const removeScope = vertexToRemove.edges;

    removeScope.forEach((edge: Edge) => {
      this.removeEdge(edge);
    });
    delete (this._vertices as VertexMap)[idx];
    const result = !(this._vertices as VertexMap)[idx];
    return result;
  }
  /**
   *
   * @param vertex
   * @param data
   * @returns
   */
  public updateVertex(
    vertex: number | Vertex,
    data?: any
  ): [GraphError?, Vertex?] {
    const idx = vertexIdx(vertex);
    if (!this._vertices[idx]) {
      return [new GraphError("Vertex with `idx` does not exist")];
    }
    const update = <Vertex>(this._vertices as VertexMap)[idx];
    data && update.setData(data);
    return [, update];
  }
  /**
   *
   * @param vertex
   * @returns
   */
  public getVertex(vertex: number | Vertex): [GraphError?, Vertex?] {
    const idx = vertexIdx(vertex);
    return !!(this._vertices as VertexMap)[idx]
      ? [, (this._vertices as VertexMap)[idx]]
      : [new GraphError("Vertex with `idx` does not exist")];
  }
  // Edges API
  /**
   * Getter, returns an array of all edges
   */
  public get edges(): Edge[] {
    return Object.values(this._edges as EdgeMap);
  }
  public addEdge(edge: Edge): [GraphError?, Edge?] {
    const rootIdx = edge.rootEdgeIdx; // Set a temp local variable
    const indices: number[] = this._edgeSiblings[rootIdx] || []; // Get reference to the existing array of siblings or set as a new array

    const nextIdx = getNextIndex(indices);
    indices.push(nextIdx);
    this._edgeSiblings[rootIdx] = indices; // update siblings
    edge.idx = edge.rootEdgeIdx.concat(`@${nextIdx}`);
    this._edges[edge.idx] = edge;
    return [, edge];
  }
  /**
   * Creates(inserts) a new edge(link).
   * @param source
   * @param target
   * @param data
   * @returns
   */
  public createEdge(
    source: number | Vertex,
    target: number | Vertex,
    data?: any
  ): [GraphError?, Edge?] {
    const sourceId = vertexIdx(source);
    const targetId = vertexIdx(target);

    const createScope = [];
    !!this._vertices[sourceId] && createScope.push(this._vertices[sourceId]); // Store reference to source vertex
    !!this._vertices[targetId] && createScope.push(this._vertices[targetId]); // Store reference to target vertex
    if (createScope.length < 2) {
      return [new GraphError("One or both vertices do not exist.")];
    }

    const [s, t] = <[Vertex, Vertex]>createScope; // Extracting references via destructuring
    const edge = new Edge(s, t, data); // Create a new edge
    s.addEdge(edge, "source"); // link source vertex and edge
    t.addEdge(edge, "target"); // link target vertex and edge
    const rootIdx = edge.rootEdgeIdx; // Set a temp local variable
    const indices: number[] = this._edgeSiblings[rootIdx] || []; // Get reference to the existing array of siblings or set as a new array

    const nextIndex = getNextIndex(indices);
    indices.push(nextIndex);
    this._edgeSiblings[rootIdx] = indices; // update siblings
    edge.idx = edge.rootEdgeIdx.concat(`@${nextIndex}`);
    this._edges[edge.idx] = edge;
    return [, edge];
  }
  /**
   *
   * @param edge
   * @returns
   */
  public removeEdge(edge: string | Edge): boolean {
    const idx = edgeIdx(edge);
    const edgeToRemove: Edge = (this._edges as EdgeMap)[idx];
    if (!edgeToRemove) {
      return false;
    }
    const [sourceIdx, targetIdx] =
      <[number, number]>(edgeToRemove as Edge).vertices || [];

    const removeScope: Vertex[] = [];
    !!this._vertices[sourceIdx] &&
      removeScope.push((this._vertices as VertexMap)[sourceIdx]);
    !!this._vertices[targetIdx] &&
      removeScope.push((this._vertices as VertexMap)[targetIdx]);

    removeScope.forEach((vertex) => {
      vertex.removeEdge(edgeToRemove as Edge);
    });
    const indexes: string[] =
      this._edgeSiblings[(edgeToRemove as Edge).rootEdgeIdx] || [];

    const [, instanceIdx] = (edgeToRemove as Edge).idx.split("@");
    indexes.splice(parseInt(instanceIdx, 10), 1);
    this._edgeSiblings[(edgeToRemove as Edge).rootEdgeIdx] = indexes;
    delete this._edges[(edgeToRemove as Edge).idx];
    const result = !this._edges[(edgeToRemove as Edge).idx];
    return result;
  }
  /**
   *
   * @param edge
   * @param data
   * @returns
   */
  public updateEdge(edge: string | Edge, data?: any): [GraphError?, Edge?] {
    const idx = edgeIdx(edge);
    if (!this._edges[idx]) {
      return [new GraphError("Edge with `idx` does not exist")];
    }
    const update = <Edge>this._edges[idx];
    update && update.setData(data);
    return [, update];
  }
  /**
   *
   * @param edge
   * @returns
   */
  public getEdge(edge: string | Edge): [GraphError?, Edge?] {
    const idx = edgeIdx(edge);
    return !!this._edges[idx]
      ? [, this._edges[idx]]
      : [new GraphError("Edge with `idx` does not exist")];
  }
  /**
   * Removes all edges
   */
  public cleanEdges(): void {
    this._edges = Object.create(null) as EdgeMap;
    this._edgeSiblings = Object.create(null) as EdgeSiblings;
    Object.values(this._vertices as VertexMap).forEach((v) => v.cleanEdges());
  }

  // Query and basic metrics API
  public hasVertex(vertex: number | Vertex): boolean {
    const idx = vertexIdx(vertex);
    return !!(this._vertices as VertexMap)[idx];
  }
  public hasEdge(edge: string | Edge): boolean {
    const idx = edgeIdx(edge);
    return !!(this._edges as EdgeMap)[idx];
  }
  public verticesCount(): number {
    return Object.keys(this._vertices as VertexMap).length;
  }
  public edgesCount(): number {
    return Object.keys(this._edges as EdgeMap).length;
  }

  // Serialisation API
  public toObject(): Record<string, any> {
    return {};
  }
}
