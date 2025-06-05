allprojects {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }

    group = "fhv.omni.core"
    version = "0.3.0"
}

plugins {
    java
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
    jacoco
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    developmentOnly("org.springframework.boot:spring-boot-devtools")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    implementation(project(":core:microservice"))
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.named<Jar>("bootJar") {
    archiveClassifier.set("full")
    exclude("application.properties")
    exclude("logback.xml")
    exclude(".gitignore")
}

tasks.register<Copy>("writeVersion") {
    from("src/main/resources/static")
    into(layout.buildDirectory.dir("resources/main/static"))
    include("index.html")
    filter { line: String ->
        line.replace("LOCAL_VERSION", project.version.toString())
    }
}

tasks.named("classes") {
    dependsOn(tasks.named("writeVersion"))
}

tasks.withType<Test> {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required = true
    }
}