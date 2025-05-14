import { users, posts, comments, type User, type InsertUser, type Post, type InsertPost, type Comment, type InsertComment } from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUid(uid: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>; // Added for Doigs on Payroll page
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>; // Added to support profile updates
  
  // Post operations
  getPost(id: number): Promise<Post | undefined>;
  getAllPosts(): Promise<Post[]>;
  getPostsByAuthor(authorId: number): Promise<Post[]>; // Added to support profile page
  createPost(post: InsertPost & { authorId: number }): Promise<Post>;
  updatePost(id: number, post: Partial<Post>): Promise<Post | undefined>;
  deletePost(id: number): Promise<boolean>;
  
  // Comment operations
  getComment(id: number): Promise<Comment | undefined>;
  getCommentsByPostId(postId: number): Promise<Comment[]>;
  getCommentReplies(commentId: number): Promise<Comment[]>; // Get replies to a specific comment
  createComment(comment: InsertComment & { authorId: number }): Promise<Comment>;
  updateComment(id: number, commentData: Partial<Comment>): Promise<Comment | undefined>; // Edit a comment
  deleteComment(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private usersData: Map<number, User>;
  private postsData: Map<number, Post>;
  private commentsData: Map<number, Comment>;
  private userId: number;
  private postId: number;
  private commentId: number;

  constructor() {
    this.usersData = new Map();
    this.postsData = new Map();
    this.commentsData = new Map();
    this.userId = 1;
    this.postId = 1;
    this.commentId = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
    

  }
  
  // Initialize sample data for testing
  private initializeSampleData() {
    // Create sample user
    const sampleUser: User = {
      id: this.userId++,
      uid: "sample-user-uid",
      displayName: "Eleanor Worthington",
      email: "eleanor@example.com",
      photoURL: "https://randomuser.me/api/portraits/women/32.jpg",
      createdAt: new Date().toISOString()
    };
    this.usersData.set(sampleUser.id, sampleUser);
    
    // Create sample post for May 2025
    const samplePost: Post = {
      id: this.postId++,
      title: "The Decline of Traditional Print Media in the Digital Age",
      content: `<h2>A Shifting Landscape</h2>
      <p>As we approach the mid-2020s, the transformation of traditional print journalism continues unabated. Newspapers and magazines that once dominated the media landscape have given way to digital platforms, social media news sources, and citizen journalism.</p>
      <p>The venerable institutions that once served as the primary sources of news and commentary have been forced to adapt or face extinction. Many have chosen hybrid models, maintaining limited print operations while focusing increasingly on their digital presence.</p>
      <h2>Economic Realities</h2>
      <p>The economic model that sustained print journalism for centuries—based on advertising revenue and subscriptions—has been upended by the internet. Classified advertising, once a reliable profit center for newspapers, has largely migrated to online platforms.</p>
      <p>Display advertising, while still present in print publications, commands a fraction of its former rates. The abundance of digital advertising space has driven down costs across the board, leaving traditional publications struggling to maintain profitability.</p>
      <h2>Quality and Trust</h2>
      <p>Perhaps the most concerning aspect of this transition is the impact on journalistic quality and public trust. The economic pressures on traditional media outlets have led to staff reductions, decreased investigative reporting, and in some cases, a shift toward more sensationalistic coverage to attract readers.</p>
      <p>While digital-native news sources have introduced innovations in reporting and presentation, the ecosystem as a whole has become more fragmented and polarized. The shared experience of consuming news from a common set of sources has given way to highly personalized information streams that often reinforce existing beliefs rather than challenging them.</p>
      <h2>The Path Forward</h2>
      <p>Yet there are reasons for optimism. Some publications have successfully reinvented themselves for the digital age, finding new revenue streams through digital subscriptions, events, and specialized content. Others have embraced nonprofit models, supported by foundations and reader contributions.</p>
      <p>The hunger for reliable information and thoughtful analysis remains strong, suggesting that the core functions of journalism will endure even as its form evolves. The challenge for the industry—and for society—is to ensure that these functions continue to be fulfilled in ways that serve the public interest.</p>`,
      authorId: sampleUser.id,
      author: sampleUser,
      createdAt: "2025-05-01T10:00:00.000Z",
      updatedAt: "2025-05-01T10:00:00.000Z",
      tags: ["Media", "Journalism", "Digital Transformation"],
      commentCount: 0
    };
    this.postsData.set(samplePost.id, samplePost);
    
    // Create another rich sample post
    const samplePost2: Post = {
      id: this.postId++,
      title: "The Renaissance of Local Community Gardens",
      content: `<h2>Growing More Than Just Plants</h2>
      <p>In the shadow of gleaming skyscrapers and amid the constant hum of urban life, a quiet revolution is taking place in neighborhoods across the country. Community gardens, once dismissed as quaint relics or temporary placeholders for development, have emerged as vital centers of sustainability, education, and social cohesion.</p>
      
      <p>The statistics tell part of the story: over the past decade, the number of registered community gardens has increased by nearly 60% nationwide. But numbers alone cannot capture the transformative impact these green spaces have on their surrounding communities.</p>
      
      <h2>From Food Deserts to Flourishing Oases</h2>
      <p>In many urban areas classified as "food deserts"—neighborhoods with limited access to affordable, nutritious food—community gardens have become essential sources of fresh produce. "Before our garden started, the nearest place to buy fresh vegetables was a 45-minute bus ride away," explains Maria Gonzalez, coordinator of the Harmony Garden in East Baltimore. "Now we're growing over 30 different vegetables and herbs right here in the neighborhood."</p>
      
      <p>The health benefits extend beyond improved nutrition. Studies have consistently shown that active participation in gardening correlates with reduced stress levels, improved mental health outcomes, and increased physical activity among participants of all ages.</p>
      
      <h2>Educational Laboratories</h2>
      <p>For children raised in concrete environments with few connections to natural systems, community gardens offer invaluable experiential learning opportunities. Many gardens have developed partnerships with local schools, creating programs where science and environmental curriculum comes alive outside the classroom.</p>
      
      <blockquote>
        <p>"When a child plants a seed, tends the growing plant, and harvests the food, they're learning fundamental lessons about biology, ecology, nutrition, and patience," says Dr. James Wilson, an education researcher who has studied the effects of garden-based learning programs. "These are lessons that stick with them far longer than anything they might read in a textbook."</p>
      </blockquote>
      
      <h2>Building Community Resilience</h2>
      <p>Perhaps the most remarkable aspect of successful community gardens is their ability to strengthen social bonds. In an era when many Americans report feeling increasingly isolated, gardens create natural gathering places where people of different ages, backgrounds, and life experiences work toward common goals.</p>
      
      <p>This social connectivity translates into tangible benefits for neighborhoods. Research from the Urban Institute indicates that areas surrounding active community gardens typically see reduced crime rates, increased property values, and higher levels of civic engagement.</p>
      
      <h2>Challenges and Opportunities</h2>
      <p>Despite their benefits, community gardens face significant challenges. Securing long-term land access remains difficult in many cities, where development pressures and rising property values create uncertainty. Water access, soil contamination, and sustainable funding models present ongoing obstacles.</p>
      
      <p>Innovative solutions are emerging to address these challenges. Some cities have established land trusts specifically for community gardens, providing permanent protection from development. Others have revised zoning codes to explicitly support urban agriculture. Grant programs, both public and private, have expanded to provide crucial infrastructure and technical assistance.</p>
      
      <h2>The Future Is Growing</h2>
      <p>As cities grapple with climate change, food security, and community resilience, community gardens offer proven, grassroots solutions to some of our most pressing urban problems. They demonstrate that sometimes the most powerful transformations begin with the simple act of planting a seed.</p>
      
      <p>The modern community garden movement reminds us that even in our increasingly digital, disconnected world, our need for connection—to nature and to each other—remains as essential as ever.</p>`,
      authorId: sampleUser.id,
      author: sampleUser,
      createdAt: "2025-05-10T14:30:00.000Z",
      updatedAt: "2025-05-10T14:30:00.000Z",
      tags: ["Community", "Gardening", "Urban Agriculture", "Sustainability"],
      commentCount: 0
    };
    this.postsData.set(samplePost2.id, samplePost2);
    
    // Add a more consistent test post
    const userPost: Post = {
      id: this.postId++,
      title: "The Future of Artificial Intelligence in Everyday Life",
      content: "<h2>From Science Fiction to Reality</h2><p>Artificial Intelligence has rapidly evolved from a distant science fiction concept to an integral part of our daily lives. Smart assistants, recommendation algorithms, and automated systems now blend seamlessly into our routines, often without us even noticing their presence.</p><p>As we look toward the future, the integration of AI into everyday objects and services will only deepen, changing how we interact with technology and each other.</p><h2>Ethics and Boundaries</h2><p>The rapid advancement of AI technology brings important ethical considerations to the forefront. Questions about privacy, bias in algorithms, and the appropriate limits of automation require thoughtful discussion and careful regulation.</p><p>Finding the right balance between innovation and ethical constraints will be one of the defining challenges of the coming decade.</p>",
      authorId: 2,
      author: {
        id: 2,
        uid: "personal-user",
        displayName: "Mikhail Dvorsky", 
        email: "reader@ribbattimes.com",
        photoURL: "https://i.pravatar.cc/150?u=ribbattimes",
        createdAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["Technology", "Ethics", "Future"],
      commentCount: 0
    };
    this.postsData.set(userPost.id, userPost);
    
    // Add April 14, 2025 post
    const aprilPost: Post = {
      id: this.postId++,
      title: "April 14, 2025 - Spring Season Highlights",
      content: "<h2>Spring Season Update</h2><p>As we move into mid-April, The Ribbat Times brings you the latest highlights of the season. This month has been particularly eventful with several key developments worth noting.</p><p>First, the annual spring festival saw record attendance this year, with over 5,000 participants joining from across the region. The community-led initiative featured local artists, musicians, and food vendors, creating a vibrant atmosphere that truly captured the essence of our town.</p><h3>Technology Developments</h3><p>In tech news, several startups in our area have secured significant funding this quarter. Most notably, GreenTech Solutions received a $2.3M investment to expand their sustainable energy projects. Their innovative approach to solar power integration has gained attention from industry leaders.</p><p>The local university has also launched a new research center dedicated to climate science, bringing together experts from various disciplines to address environmental challenges.</p><h3>Community Initiatives</h3><p>On the community front, the neighborhood beautification project has entered its second phase, with volunteers planting over 200 native trees and shrubs in public spaces. This initiative aims to enhance biodiversity and create more green spaces for residents to enjoy.</p><p>The city council has approved plans for a new community center that will provide resources for education, recreation, and social services. Construction is scheduled to begin next month.</p><p>Looking ahead to May, we have several exciting events planned that will bring our community together. Stay tuned for more updates in our next issue.</p>",
      authorId: 2,
      author: {
        id: 2,
        uid: "personal-user",
        displayName: "Mikhail Dvorsky", 
        email: "reader@ribbattimes.com",
        photoURL: "https://i.pravatar.cc/150?u=ribbattimes",
        createdAt: new Date().toISOString()
      },
      createdAt: "2025-04-14T10:00:00.000Z",
      updatedAt: "2025-04-14T10:00:00.000Z",
      tags: ["Spring", "Community", "Technology", "Local News"],
      commentCount: 0
    };
    this.postsData.set(aprilPost.id, aprilPost);
    
    // Add June 15, 2025 post
    const junePost: Post = {
      id: this.postId++,
      title: "June 15, 2025 - Summer Solstice Special Edition",
      content: "<h2>Summer Solstice Special Edition</h2><p>Welcome to our summer solstice special edition of The Ribbat Times. As we approach the longest day of the year, we're celebrating with a roundup of summer activities, environmental updates, and community news.</p><h3>Summer Festival Series</h3><p>The city's Summer Festival Series kicks off next weekend with three consecutive weekends of music, art, and cultural celebrations. This year's theme, \"Unity in Diversity,\" highlights the rich multicultural heritage of our community.</p><p>The main stage will feature performances from local and international artists, while the community square will host workshops, food stalls, and interactive art installations. Don't miss the night market on Saturday evenings, offering handcrafted goods from local artisans.</p><h3>Environmental Update</h3><p>The conservation department reports a successful nesting season for the protected shore birds along our coastline. The population has seen a 15% increase compared to last year, thanks to community-led protection efforts and habitat restoration projects.</p><p>Citizens are reminded that the seasonal beach access restrictions remain in effect until July 30th to ensure the continued safety of these vulnerable ecosystems.</p><h3>Community Garden Expansion</h3><p>The downtown community garden project has received approval for expansion, with ten new plots being added next month. Applications for these plots are now open, with priority given to educational institutions and community groups.</p><p>The garden's education center has also announced a summer workshop series covering organic gardening techniques, composting, and sustainable urban agriculture.</p><p>We wish everyone a wonderful start to the summer season and look forward to seeing you at the upcoming community events!</p>",
      authorId: 2,
      author: {
        id: 2,
        uid: "personal-user",
        displayName: "Mikhail Dvorsky", 
        email: "reader@ribbattimes.com",
        photoURL: "https://i.pravatar.cc/150?u=ribbattimes",
        createdAt: new Date().toISOString()
      },
      createdAt: "2025-06-15T15:30:00.000Z",
      updatedAt: "2025-06-15T15:30:00.000Z",
      tags: ["Summer", "Solstice", "Festival", "Environment", "Community"],
      commentCount: 0
    };
    this.postsData.set(junePost.id, junePost);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(user => user.uid === uid);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...userData, 
      id,
      createdAt: new Date().toISOString() 
    };
    this.usersData.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.usersData.get(id);
    if (!user) {
      return undefined;
    }
    
    const updatedUser: User = {
      ...user,
      ...userData
    };
    
    this.usersData.set(id, updatedUser);
    return updatedUser;
  }

  // Post operations
  async getPost(id: number): Promise<Post | undefined> {
    return this.postsData.get(id);
  }

  async getAllPosts(): Promise<Post[]> {
    return Array.from(this.postsData.values()).sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  
  async getPostsByAuthor(authorId: number): Promise<Post[]> {
    return Array.from(this.postsData.values())
      .filter(post => post.authorId === authorId)
      .sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  async createPost(postData: InsertPost & { authorId: number }): Promise<Post> {
    const id = this.postId++;
    const now = new Date().toISOString();
    const post: Post = {
      ...postData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.postsData.set(id, post);
    return post;
  }

  async updatePost(id: number, postData: Partial<Post>): Promise<Post | undefined> {
    const post = this.postsData.get(id);
    if (!post) return undefined;

    const updatedPost: Post = {
      ...post,
      ...postData,
      updatedAt: new Date().toISOString()
    };
    this.postsData.set(id, updatedPost);
    return updatedPost;
  }

  async deletePost(id: number): Promise<boolean> {
    // Delete all comments for this post first
    for (const [commentId, comment] of this.commentsData.entries()) {
      if (comment.postId === id) {
        this.commentsData.delete(commentId);
      }
    }
    return this.postsData.delete(id);
  }

  // Comment operations
  async getComment(id: number): Promise<Comment | undefined> {
    return this.commentsData.get(id);
  }

  async getCommentsByPostId(postId: number): Promise<Comment[]> {
    // Log all comments for debugging
    console.log(`All comments in storage:`, Array.from(this.commentsData.entries()).map(([id, c]) => 
      ({ id, postId: c.postId, content: c.content.substring(0, 20) + '...' }))
    );
    
    // Get only top-level comments for this post (no parent comment)
    const filteredComments = Array.from(this.commentsData.values())
      .filter(comment => {
        const matches = comment.postId === postId && !comment.parentId;
        console.log(`Comment ${comment.id} for post ${comment.postId} matches postId ${postId}? ${matches}`);
        return matches;
      })
      .sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    
    console.log(`Returning ${filteredComments.length} top-level comments for post ${postId}`);
    return filteredComments;
  }
  
  async getCommentReplies(commentId: number): Promise<Comment[]> {
    console.log(`Fetching replies for comment ID: ${commentId}`);
    
    // Get all replies to this comment (where parentId equals this comment's id)
    const replies = Array.from(this.commentsData.values())
      .filter(comment => comment.parentId === commentId)
      .sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      
    console.log(`Found ${replies.length} replies for comment ${commentId}`);
    return replies;
  }

  async createComment(commentData: InsertComment & { authorId: number }): Promise<Comment> {
    const id = this.commentId++;
    const now = new Date().toISOString();
    
    // Ensure the postId is properly set
    if (!commentData.postId) {
      throw new Error('Comment must have a postId');
    }
    
    // Create the comment with all required fields
    const comment: Comment = {
      ...commentData,
      id,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
      // Handle optional fields
      parentId: commentData.parentId || null,
      elementId: commentData.elementId || null,
      selectedText: commentData.selectedText || null,
      selectionStart: commentData.selectionStart || null,
      selectionEnd: commentData.selectionEnd || null
    };
    
    console.log(`Creating new comment with ID: ${id}, postId: ${comment.postId}, content: "${comment.content.substring(0, 20)}..."`);
    
    // Store it in the map
    this.commentsData.set(id, comment);
    
    // Log the current state after adding
    console.log(`Storage now has ${this.commentsData.size} total comments`);
    
    return comment;
  }
  
  async updateComment(id: number, commentData: Partial<Comment>): Promise<Comment | undefined> {
    const comment = this.commentsData.get(id);
    
    if (!comment) {
      console.log(`Comment with ID ${id} not found for update`);
      return undefined;
    }
    
    const now = new Date().toISOString();
    
    const updatedComment: Comment = {
      ...comment,
      ...commentData,
      updatedAt: now,
      isEdited: true
    };
    
    console.log(`Updating comment with ID: ${id}, new content: "${updatedComment.content.substring(0, 20)}..."`);
    
    this.commentsData.set(id, updatedComment);
    return updatedComment;
  }

  async deleteComment(id: number): Promise<boolean> {
    console.log(`Deleting comment with ID: ${id}`);
    
    // First, get all replies to this comment
    const replies = await this.getCommentReplies(id);
    
    // Delete all replies first
    for (const reply of replies) {
      console.log(`Deleting reply with ID: ${reply.id} to comment ${id}`);
      this.commentsData.delete(reply.id);
    }
    
    // Then delete the comment itself
    return this.commentsData.delete(id);
  }
}

// Import the database storage
import { DatabaseStorage } from './dbStorage';

// Use database storage in production, memory storage in development
const isProduction = process.env.NODE_ENV === 'production';

export const storage = isProduction 
  ? new DatabaseStorage()
  : new MemStorage();
